export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("LeoBot is online ✅", {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=UTF-8",
        },
      });
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
};
