import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig({
  server: {
    host: true,            // 0.0.0.0 で全LAN端末からアクセス可能
    port: 5173,            // Vite既定ポート
    https: {
      key:  fs.readFileSync("./cert/key.pem"),   // 作成した証明書のパス
      cert: fs.readFileSync("./cert/cert.pem")
    }
  }
});