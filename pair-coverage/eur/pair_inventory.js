const EUR_PAIR_INVENTORY = Object.freeze([
  { pairCode: "EUR_USD", pairLabel: "EUR/USD", baseAsset: "EUR", quoteAsset: "USD", priceRequirements: ["direct EUR/USD feed"] },
  { pairCode: "EUR_GBP", pairLabel: "EUR/GBP", baseAsset: "EUR", quoteAsset: "GBP", priceRequirements: ["direct EUR/GBP feed", "or synchronized EUR/USD and GBP/USD legs"] },
  { pairCode: "XAU_EUR", pairLabel: "XAU/EUR", baseAsset: "GOLD", quoteAsset: "EUR", priceRequirements: ["identified XAU/EUR feed", "or synchronized XAU/USD and EUR/USD legs"] },
  { pairCode: "XAG_EUR", pairLabel: "XAG/EUR", baseAsset: "SILVER", quoteAsset: "EUR", priceRequirements: ["identified XAG/EUR feed", "or synchronized XAG/USD and EUR/USD legs"] },
  { pairCode: "WTI_EUR", pairLabel: "WTI/EUR", baseAsset: "WTI", quoteAsset: "EUR", priceRequirements: ["identified WTI/EUR feed", "or synchronized WTI/USD and EUR/USD legs"] },
  { pairCode: "NQ_EUR", pairLabel: "NQ/EUR", baseAsset: "NQ", quoteAsset: "EUR", priceRequirements: ["identified NQ/EUR feed", "or synchronized NQ/USD and EUR/USD legs"] },
  { pairCode: "BTC_EUR", pairLabel: "BTC/EUR", baseAsset: "BTC", quoteAsset: "EUR", priceRequirements: ["direct BTC/EUR feed", "or synchronized BTC/USD and EUR/USD legs"] }
]);

module.exports = { EUR_PAIR_INVENTORY };