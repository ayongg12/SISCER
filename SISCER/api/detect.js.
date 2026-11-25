const WORKFLOW_URL =
  "https://serverless.roboflow.com/marias-workspace-latfm/workflows/benda-meja-kelompok-10";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ROBOFLOW_API_KEY belum diatur. Tambahkan di Vercel Project Settings > Environment Variables.",
    });
  }

  try {
    const { image } = req.body || {};
    if (typeof image !== "string" || !image) {
      return res.status(400).json({ error: "Field 'image' wajib diisi dengan data URL/base64 gambar." });
    }

    // Browser sends a JPEG data URL. Roboflow Workflows accepts base64 image input.
    const base64 = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!base64 || base64.length > 8_000_000) {
      return res.status(413).json({ error: "Gambar kosong atau terlalu besar. Kurangi resolusi kamera." });
    }

    const upstream = await fetch(WORKFLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          image: {
            type: "base64",
            value: base64,
          },
        },
      }),
    });

    const raw = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }

    if (!upstream.ok) {
      console.error("Roboflow response:", upstream.status, payload);
      return res.status(upstream.status).json({
        error: "Roboflow inference request failed.",
        details: payload,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Detection API error:", error);
    return res.status(500).json({ error: "Internal server error while running inference." });
  }
};
