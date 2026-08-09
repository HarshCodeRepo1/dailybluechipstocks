import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const secrets = new SecretsManagerClient({});
const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const secretId = process.env.MARKETSTACK_SECRET_ID;
const rawBucket = process.env.MARKET_RAW_BUCKET;
const signalsTable = process.env.MARKET_SIGNALS_TABLE;
const historyTable = process.env.MARKET_HISTORY_TABLE;
const runsTable = process.env.MARKET_INGESTION_RUNS_TABLE;
const chunkDays = Number(process.env.BOOTSTRAP_CHUNK_DAYS ?? "28");
const thresholdPercent = Number(process.env.SIGNAL_THRESHOLD_PERCENT ?? "1");

const symbols = (process.env.MARKET_SYMBOLS ?? "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

const WINDOWS = [
  { label:"1Y",days:365 }, { label:"6M",days:180 }, { label:"4M",days:120 },
  { label:"3M",days:90 }, { label:"2M",days:60 }, { label:"1M",days:30 },
  { label:"1W",days:7 },
];

function easternDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit"
  }).format(now);
}

function addDays(s, n) {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}

async function getApiKey() {
  const result = await secrets.send(new GetSecretValueCommand({SecretId:secretId}));
  if (!result.SecretString) throw new Error("Secret is empty");
  let parsed; try { parsed=JSON.parse(result.SecretString); } catch { parsed=null; }
  return parsed?.MARKETSTACK_API_KEY ?? parsed?.access_key ?? result.SecretString;
}

async function fetchWindow(apiKey, from, to) {
  const params = new URLSearchParams({
    access_key: apiKey,
    symbols: symbols.join(","),
    date_from: from,
    date_to: to,
    limit: "1000",
    sort: "DESC",
  });

  const url = `https://api.marketstack.com/v2/eod?${params.toString()}`;
  const response = await fetch(url, {
    headers:{accept:"application/json"},
    signal:AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Marketstack HTTP ${response.status}: ${text.slice(0,500)}`);
  const payload = JSON.parse(text);
  if (payload?.error) throw new Error(`Marketstack error: ${JSON.stringify(payload.error)}`);
  return {payload,text};
}

async function writeRaw(index, from, to, text) {
  const key = `bootstrap/${from}_${to}/chunk-${String(index).padStart(2,"0")}.json`;
  await s3.send(new PutObjectCommand({
    Bucket:rawBucket, Key:key, Body:text, ContentType:"application/json",
    ServerSideEncryption:"AES256",
  }));
  return key;
}

async function writeHistory(data, sourceKey) {
  const now = new Date().toISOString();
  await Promise.all(data.map(async (r) => {
    const symbol=String(r.symbol??"").toUpperCase();
    const marketDate=String(r.date??"").slice(0,10);
    if (!symbol || !marketDate) return;
    await ddb.send(new PutCommand({
      TableName:historyTable,
      Item:{
        symbol,marketDate,open:r.open??null,high:r.high??null,low:r.low??null,
        close:r.close??null,adjClose:r.adj_close??null,volume:r.volume??null,
        exchange:r.exchange??null,sourceKey,ingestedAt:now
      }
    }));
  }));
}

function currentPrice(item) {
  const md=item.middayMarketDate??"", cd=item.closeMarketDate??"";
  if (item.middayPrice!=null && md>=cd) return Number(item.middayPrice);
  return item.closePrice==null?null:Number(item.closePrice);
}

function classify(price, history) {
  if (price==null || !history.length) return {signal:"NORMAL",side:"NORMAL",period:null};
  const dates=history.map(x=>x.marketDate).sort();
  const latest=dates.at(-1), earliest=dates[0], threshold=thresholdPercent/100;

  for (const w of WINDOWS) {
    const start=addDays(latest,-w.days);
    if (earliest>start) continue;
    const closes=history.filter(x=>x.marketDate>=start)
      .map(x=>Number(x.adjClose??x.close)).filter(Number.isFinite);
    if (!closes.length) continue;
    const min=Math.min(...closes), max=Math.max(...closes);
    const nearLow=price<=min*(1+threshold), nearHigh=price>=max*(1-threshold);
    if (nearLow&&!nearHigh) return {signal:`${w.label} LOW`,side:"LOW",period:w.label,low:min,high:max};
    if (nearHigh&&!nearLow) return {signal:`${w.label} HIGH`,side:"HIGH",period:w.label,low:min,high:max};
    if (nearLow&&nearHigh) {
      const dl=Math.abs(price-min)/Math.max(min,.0001), dh=Math.abs(max-price)/Math.max(max,.0001);
      return dl<=dh
        ? {signal:`${w.label} LOW`,side:"LOW",period:w.label,low:min,high:max}
        : {signal:`${w.label} HIGH`,side:"HIGH",period:w.label,low:min,high:max};
    }
  }
  return {signal:"NORMAL",side:"NORMAL",period:null};
}

async function recomputeSignals() {
  const latestResult=await ddb.send(new BatchGetCommand({
    RequestItems:{[signalsTable]:{Keys:symbols.map(symbol=>({symbol}))}}
  }));
  const latest=latestResult.Responses?.[signalsTable]??[];
  const bySymbol=new Map(latest.map(x=>[x.symbol,x]));

  await Promise.all(symbols.map(async symbol=>{
    const item=bySymbol.get(symbol); if(!item) return;
    const hist=await ddb.send(new QueryCommand({
      TableName:historyTable,
      KeyConditionExpression:"symbol=:symbol AND marketDate>=:from",
      ExpressionAttributeValues:{":symbol":symbol,":from":addDays(easternDateString(),-370)}
    }));
    const c=classify(currentPrice(item),hist.Items??[]);
    await ddb.send(new UpdateCommand({
      TableName:signalsTable,Key:{symbol},
      UpdateExpression:"SET #signal=:signal,signalSide=:side,signalPeriod=:period,rangeLow=:low,rangeHigh=:high,signalThresholdPercent=:threshold,signalCalculatedAt=:at",
      ExpressionAttributeNames:{"#signal":"signal"},
      ExpressionAttributeValues:{
        ":signal":c.signal,":side":c.side,":period":c.period,":low":c.low??null,
        ":high":c.high??null,":threshold":thresholdPercent,":at":new Date().toISOString()
      }
    }));
  }));
}

export const handler = async () => {
  const existing=await ddb.send(new GetCommand({
    TableName:runsTable,Key:{runKey:"ONE_YEAR_BOOTSTRAP"},ConsistentRead:true
  }));
  if(existing.Item?.status==="COMPLETE") {
    return {skipped:true,reason:"BOOTSTRAP_ALREADY_COMPLETE",...existing.Item.details};
  }

  const apiKey=await getApiKey();
  const end=easternDateString();
  const floor=addDays(end,-365);
  let to=end;
  let callCount=0, recordsWritten=0;

  await ddb.send(new PutCommand({
    TableName:runsTable,
    Item:{runKey:"ONE_YEAR_BOOTSTRAP",status:"STARTED",startedAt:new Date().toISOString()}
  }));

  try {
    while(to>=floor) {
      let from=addDays(to,-(chunkDays-1));
      if(from<floor) from=floor;

      // One Marketstack request per loop. ~14 total at 28-day chunks.
      const {payload,text}=await fetchWindow(apiKey,from,to);
      callCount++;
      const data=Array.isArray(payload?.data)?payload.data:[];
      const sourceKey=await writeRaw(callCount,from,to,text);
      await writeHistory(data,sourceKey);
      recordsWritten+=data.length;

      if(from===floor) break;
      to=addDays(from,-1);
    }

    await recomputeSignals();

    const details={callCount,recordsWritten,from:floor,to:end,symbolCount:symbols.length};
    await ddb.send(new PutCommand({
      TableName:runsTable,
      Item:{
        runKey:"ONE_YEAR_BOOTSTRAP",status:"COMPLETE",
        completedAt:new Date().toISOString(),details
      }
    }));

    return {ok:true,...details};
  } catch(error) {
    await ddb.send(new PutCommand({
      TableName:runsTable,
      Item:{
        runKey:"ONE_YEAR_BOOTSTRAP",status:"FAILED",
        failedAt:new Date().toISOString(),
        details:{callCount,recordsWritten,message:error instanceof Error?error.message:String(error)}
      }
    }));
    throw error;
  }
};
