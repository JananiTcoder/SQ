// api/update-motor.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method === "POST") {
    const filePath = path.join(process.cwd(), "json.json");
    const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    current.motor_time = req.body.motor_time ?? 30;
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
    res.status(200).json({ ok: true });
  } else {
    res.status(405).end();
  }
}
