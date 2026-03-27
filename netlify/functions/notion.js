// Netlify Serverless Function — Notion API Proxy
// 解決瀏覽器 CORS 限制，所有 Notion API 請求都透過這裡轉發

exports.handler = async (event) => {
  // 只允許 POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { token, method, endpoint, body } = JSON.parse(event.body);

    if (!token || !endpoint) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing token or endpoint" }) };
    }

    const url = `https://api.notion.com/v1/${endpoint}`;
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    const fetchOptions = {
      method: method || "GET",
      headers,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
