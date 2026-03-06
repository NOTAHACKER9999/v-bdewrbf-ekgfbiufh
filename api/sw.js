export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  res.status(501).send("WebSocket upgrade required");
}
