import { hanimeApi } from '../../lib/hanime.js';

let handler = async (m, { conn }) => {
  try {
    const time = 'week';  // Example: 'day', 'week', or 'month'
    const page = 1;
    
   const trendingVideos = await hanimeApi.getTrending(time, page);
    if (trendingVideos.length === 0) {
      return conn.reply(m.chat, 'No trending videos found at the moment.', m);
    }
    let replyMessage = 'Trending Videos:\n\n';
    trendingVideos.forEach((video, index) => {
      replyMessage += `${index + 1}. ${video.name}\nLink: ${video.link}\nViews: ${video.views}\n\n`;
    });
    return conn.reply(m.chat, replyMessage, m);
  } catch (error) {
    console.error('Error fetching trending videos:', error);
    return conn.reply(m.chat, 'Sorry, there was an issue fetching trending videos. Please try again later.', m);
  }
}

handler.help = ['trending'];
handler.tags = ['nsfw'];
handler.command = /^(trending)$/i;

export default handler;
