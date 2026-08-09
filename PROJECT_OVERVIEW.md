# DailyBlueChipStocks: Project Overview

## What this project is

DailyBlueChipStocks is a plain-English stock-watchlist website. Its goal is to help people follow a small group of well-known US companies without needing to live inside a complicated trading app.

Rather than telling someone what to buy or sell, the site highlights when a selected company is trading close to the high or low end of its recent price range. It also explains the result in simple language. The footer makes the intended boundary clear: this is educational information, not financial advice.

The project has two connected parts:

1. The **website** people see and use.
2. The **AWS service** behind it, which handles sign-in, preferences, stored market data, and email newsletters.

## What a visitor sees

The public home page has a calm, finance-focused design with dark navy text, green highlights, rounded cards, and lots of breathing room. On a desktop screen it presents:

- A header with the DailyBlueChipStocks brand, section links, and a sign-in button.
- A hero message: "Great companies. Interesting prices."
- A quick, easy-to-scan market summary and index cards.
- A blue-chip watchlist area and a section for stocks near historical lows.
- Educational cards covering a sector spotlight, market mood, and an investing lesson.
- A simple option-strategy explainer and newsletter sign-up call to action.
- A footer that states the educational/not-financial-advice disclaimer.

The public page is intended to show a default group of ten blue-chip companies once the public market-data service is available. If data cannot be loaded, the site stays usable and displays a sign-in/fallback message instead of failing.

## What changes after sign-in

Sign-in is provided by Amazon Cognito, AWS's user-account service. A signed-in user can:

- Choose sectors of interest, such as Technology, Healthcare, Energy, or Financials.
- Choose individual supported stocks.
- Choose price-range alert periods, from one month to one year.
- Opt in or out of the newsletter.
- Save those choices for later.

For clarity, the displayed watchlist and each newsletter are capped at ten stocks. When a user has not picked individual stocks, the service falls back to a standard blue-chip list. Sector selections are saved as preferences, but the current watchlist selection is deliberately based on explicit stock choices only.

## How the market signal works

The service tracks around 30 large US companies, including Apple, Microsoft, NVIDIA, Amazon, JPMorgan Chase, Visa, Costco, Exxon Mobil, and others.

For each supported company, it compares the most recent available price with the company's recent trading history. It considers periods of one week, one month, two months, three months, four months, six months, and one year.

If the price is within 1% of the low end of a period, the stock is labelled, for example, **"3M LOW."** If it is within 1% of the high end, it is labelled **"3M HIGH."** Otherwise it is labelled **"NORMAL."** Low-range results are sorted ahead of normal and high-range results, which makes possible opportunities easy to spot without presenting them as investment recommendations.

## How the pieces fit together

```text
Market data provider (Marketstack)
        |
        v
Scheduled AWS data refreshes --> private raw-data archive + price history
        |                                      |
        v                                      v
Latest market signals <------------------ signal calculation
        |
        +--> Public home page (default watchlist)
        +--> Signed-in personal watchlist
        +--> Newsletter builder --> Amazon SES email delivery

Website <--> Amazon Cognito sign-in <--> saved user preferences
```

The system normally refreshes prices twice on US weekdays: around midday and after the market closes, both in the New York time zone. A separate one-time bootstrap process can collect roughly a year of historical prices so the longer-range signals have enough context.

## Technology, in everyday language

| Area | Technology | Why it is used |
| --- | --- | --- |
| Website | React, TypeScript, Vite | Builds a fast, interactive website with checks that catch common coding mistakes. |
| Sign-in | Amazon Cognito | Handles secure account sign-in and passes proof of identity to the service. |
| Web service | API Gateway and AWS Lambda | Provides small, on-demand web endpoints without maintaining a server. |
| Saved data | Amazon DynamoDB | Stores user choices, latest stock signals, historic prices, and records of completed jobs. |
| Raw market snapshots | Amazon S3 | Keeps an encrypted private copy of data returned by the market-data provider. |
| Secrets | AWS Secrets Manager | Keeps the Marketstack API key out of application code. |
| Email | Amazon SES | Sends test and, when enabled, production newsletters. |
| Infrastructure | AWS SAM | Describes and deploys the AWS resources as versioned configuration. |

## Repository map

```text
src/                         The React website
  components/                Reusable page sections such as the header and watchlist
  pages/Home.tsx             The main public page
  api.ts                     The website's calls to the AWS service
  auth.ts                    Cognito sign-in setup

backend/
  template.yaml              The AWS blueprint: APIs, data stores, permissions, and schedules
  src/marketIngest/          Scheduled price refresh and signal calculation
  src/historyBootstrap/      One-time historical price loader
  src/marketView/            Public and signed-in market/watchlist responses
  src/preferences/           Reads and saves a user's preferences
  src/newsletter/            Builds and sends newsletters; includes admin preview/test routes
  src/getMe/                 Simple authenticated-user check

public/                      Site icons and other public assets
```

## Current status and important boundaries

The core website, Cognito integration, API endpoints, market-data ingestion design, preference storage, and newsletter delivery code are all present.

Some visible home-page material is currently **static presentation content**, rather than live data. This includes the broad market summary, index figures, calendar strip, insight cards, sample option idea, and the public newsletter sign-up form. The actual personalised stock list and opportunity cards are designed to use the cached backend market data.

The production newsletter schedule is intentionally deployed in a disabled state. It should stay disabled until the sending domain/address is verified in Amazon SES and test emails have been approved. Admin-only newsletter preview and test endpoints exist for that setup phase.

## Running the website locally

Prerequisites: a recent Node.js installation and the project dependencies.

```bash
npm install
npm run dev
```

Vite will print a local address, usually `http://localhost:5173`. The frontend has a default API address, but it can be changed without editing code by setting `VITE_API_URL` in a local environment file.

The current browser sign-in configuration and deployed API need to allow the local address being used. If Vite uses a different port, update the allowed frontend origin in the AWS configuration before testing sign-in or protected API calls.

## Deployment and operational notes

The AWS resources are described in `backend/template.yaml` and are intended to be deployed with the AWS SAM CLI. Deployments require an AWS account with the appropriate permissions, a configured Cognito user pool/client, a Marketstack API key saved in Secrets Manager, and an SES-verified sending address or domain.

Sensitive values must never be committed. The repository already ignores `.env` files, local build artifacts, and local SAM output. Keep the Marketstack key only in AWS Secrets Manager or an ignored local configuration file.

## Suggested next improvements

1. Replace the static market-summary and index cards with a live, clearly sourced data feed.
2. Connect the public newsletter form to a consent-aware subscription flow.
3. Add an administrator role/group and automated tests for the admin newsletter routes.
4. Add automated frontend, API, and deployment checks to continuous integration.
5. Add a clear privacy policy, terms, and unsubscribe flow before accepting real subscribers.
6. Review the CORS origin, Cognito redirect URL, and API URL for each deployed environment (local, staging, and production).

## A note for contributors

Keep the project focused on understandable market education. When changing a market signal, newsletter, or page claim, make sure the wording does not imply a guaranteed outcome or personal investment advice. Update this overview when a substantial feature moves from static/demo content to live data.
