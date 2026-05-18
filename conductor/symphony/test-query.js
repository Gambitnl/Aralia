const apiKey = process.env.LINEAR_API_KEY;

if (!apiKey) {
  throw new Error('LINEAR_API_KEY is required');
}

fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': apiKey
  },
  body: JSON.stringify({
    query: `
      query {
        issues(filter: {
          project: { slugId: { eq: "f88c771f52b2" } },
          state: { name: { in: ["Todo", "In Progress"] } }
        }) {
          nodes {
            identifier
            title
            state { name }
            project { slugId }
          }
        }
      }
    `
  })
}).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2)));
