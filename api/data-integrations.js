// Data Integrations for AgentMolt
// SEC EDGAR + GitHub API + Brave Search

const axios = require('axios');

class DataIntegrations {
  constructor() {
    this.baseUrls = {
      sec: 'https://www.sec.gov/Archives/edgar',
      github: 'https://api.github.com',
      brave: 'https://api.search.brave.com/res/v1/web/search'
    };
  }

  // SEC EDGAR - Get company filings
  async getSECData(cik) {
    try {
      // Format CIK (10 digits)
      const formattedCIK = cik.toString().padStart(10, '0');
      
      const response = await axios.get(
        `${this.baseUrls.sec}/cgi-bin/browse-edgar?action=getcompany&CIK=${formattedCIK}&type=10-K&dateb=&owner=include&count=5&output=atom`,
        {
          headers: {
            'User-Agent': 'AgentMolt Research Bot contact@agentmolt.xyz'
          }
        }
      );

      return {
        source: 'SEC EDGAR',
        cik: formattedCIK,
        filings: this.parseSECResponse(response.data),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return { error: 'SEC data unavailable', details: error.message };
    }
  }

  parseSECResponse(xmlData) {
    // Simple XML parsing for SEC Atom feed
    const filings = [];
    const entryMatches = xmlData.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    
    entryMatches.slice(0, 5).forEach(entry => {
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const date = entry.match(/<updated>(.*?)<\/updated>/)?.[1] || '';
      const link = entry.match(/<href="(.*?)"/)?.[1] || '';
      
      filings.push({ title, date, link });
    });
    
    return filings;
  }

  // GitHub API - Verify team/technical capability
  async getGitHubData(username) {
    try {
      const [user, repos] = await Promise.all([
        axios.get(`${this.baseUrls.github}/users/${username}`, {
          headers: { 'User-Agent': 'AgentMolt' }
        }),
        axios.get(`${this.baseUrls.github}/users/${username}/repos?per_page=100`, {
          headers: { 'User-Agent': 'AgentMolt' }
        })
      ]);

      const repoData = repos.data;
      const languages = {};
      let totalStars = 0;
      let totalCommits = 0;

      repoData.forEach(repo => {
        totalStars += repo.stargazers_count;
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
      });

      // Sort languages by usage
      const topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

      return {
        source: 'GitHub',
        username,
        publicRepos: user.data.public_repos,
        followers: user.data.followers,
        totalStars,
        topLanguages,
        accountCreated: user.data.created_at,
        lastActive: user.data.updated_at,
        contributionScore: this.calculateGitHubScore(repoData, user.data)
      };
    } catch (error) {
      return { error: 'GitHub data unavailable', details: error.message };
    }
  }

  calculateGitHubScore(repos, user) {
    // Simple scoring algorithm
    let score = 0;
    score += Math.min(repos.length * 5, 50); // Up to 50 for repos
    score += Math.min(user.followers * 2, 30); // Up to 30 for followers
    score += repos.reduce((sum, r) => sum + r.stargazers_count, 0); // Stars
    return Math.min(score, 100); // Cap at 100
  }

  // Web Search (Brave) - General research
  async webSearch(query, count = 5) {
    try {
      // Free tier - no API key needed for basic search
      const searchUrl = `https://search.brave.com/api/suggest?q=${encodeURIComponent(query)}`;
      
      // For full search results, would need API key
      // Fallback to web fetch for now
      return {
        source: 'Brave Search',
        query,
        results: [],
        note: 'Full search requires API key'
      };
    } catch (error) {
      return { error: 'Search unavailable', details: error.message };
    }
  }

  // Aggregate data for a company
  async aggregateCompanyData(companyName, githubUser = null, cik = null) {
    const data = {
      company: companyName,
      timestamp: new Date().toISOString(),
      sources: {}
    };

    // Parallel data fetching
    const promises = [];

    if (cik) {
      promises.push(
        this.getSECData(cik).then(result => {
          data.sources.sec = result;
        })
      );
    }

    if (githubUser) {
      promises.push(
        this.getGitHubData(githubUser).then(result => {
          data.sources.github = result;
        })
      );
    }

    await Promise.all(promises);

    return data;
  }
}

module.exports = DataIntegrations;
