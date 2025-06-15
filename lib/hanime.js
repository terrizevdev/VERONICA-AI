/**
 * ------------------------------------------------------
 * HAnime.tv Scrapping Module  | Powered by @shizoXteam
 * ------------------------------------------------------
 * Author      : @shizothetechie | Yugesh Singh
 * Description : ESM-based HAnime scrapping tools (for Get trending Hentai)
 * GitHub      : https://github.com/shizoXteam/hanime.tv
 * License     : MIT
 * ------------------------------------------------------
 * @shizoXteam | Respect the dev, retain this credit in forks
 */

import axios from 'axios';
import crypto from 'crypto';
import UserAgent from 'fake-useragent';

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.userAgent = new UserAgent();
  }

    generateSignature() {
    return crypto.randomBytes(32).toString('hex');
  }

  async fetchData(url) {
    try {
      const headers = {
        'X-Signature-Version': 'web2',
        'X-Signature': this.generateSignature(),
        'User-Agent': this.userAgent.random,
      };

      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching data: ${error.message}`);
      throw new Error('Failed to fetch data.');
    }
  }
}

class HanimeAPI extends ApiClient {
  constructor() {
    super('https://hanime.tv/api/v8');
  }

  constructTrendingUrl(time, page) {
    return `${this.baseURL}/browse-trending?time=${time}&page=${page}&order_by=views&ordering=desc`;
  }

  async getTrending(time, page) {
    const url = this.constructTrendingUrl(time, page);
    const data = await this.fetchData(url);
    
    return data.hentai_videos.map((video) => ({
      id: video.id,
      name: video.name,
      slug: video.slug,
      cover_url: video.cover_url,
      views: video.views,
      link: `https://hanime.tv/watch/${video.slug}`,
    }));
  }
}

const hanimeApi = new HanimeAPI();

// Useless function (adding soon)
const uselessAddingSoon = () => console.log('This function is still being developed.');

export { hanimeApi, uselessAddingSoon };
