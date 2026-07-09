import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cache = new Map<string, { rate: number; expires: number }>();
  private readonly cacheDurationMs = 3600000; // 1 hour caching

  async getExchangeRate(fromCurrency: string, toCurrency = 'USD'): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return 1.0;
    }

    const cacheKey = `${from}-${to}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.rate;
    }

    try {
      this.logger.log(`Fetching exchange rate for key: ${cacheKey}`);
      
      const apiKey = process.env.EXCHANGE_RATE_API_KEY;
      let url = `https://open.er-api.com/v6/latest/${from}`;
      
      if (apiKey && apiKey !== 'your-api-key' && !apiKey.startsWith('mock')) {
        url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${from}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error. Status: ${response.status}`);
      }

      const data = await response.json();
      const rates = data.rates || data.conversion_rates;
      
      if (rates && rates[to]) {
        const rate = Number(rates[to]);
        this.cache.set(cacheKey, {
          rate,
          expires: Date.now() + this.cacheDurationMs,
        });
        return rate;
      }
      
      throw new Error(`Rate not found for currency ${to} in API response.`);
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${(error as Error).message}. Falling back to 1.0.`);
      return 1.0; // Resilient fallback
    }
  }
}
