# Getting Started

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `yarn`

Installs dependencies

At first installation, you might have to run `yarn husky install`,
to setup pre-commit hooks

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3010](http://localhost:3010) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### env config

- sentry
  - VITE_SENTRY_DSN
- baseurl
  - rpc VITE_PROXY_API_URL / VITE_PROXY_SEPOLIA_API_URL
  - ws VITE_PROXY_WS_URL / VITE_PROXY_SEPOLIA_WS_URL
- wallet connect project id
  - VITE_WALLET_CONNECT_PROJECT_ID
- alchemy endpoint
  - VITE_ALCHEMY_API_KEY
- contracts(/src/shared/config/custom)
  - USDT / PRIMIT_VAULT / REFERRAL_REBATE / EARN
