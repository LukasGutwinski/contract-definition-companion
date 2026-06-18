import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const httpsEnabled = process.env.VITE_HTTPS !== "false";
const officeCertDir = path.join(os.homedir(), ".office-addin-dev-certs");
const officeCert = path.join(officeCertDir, "localhost.crt");
const officeKey = path.join(officeCertDir, "localhost.key");
const officeHttps =
  httpsEnabled && fs.existsSync(officeCert) && fs.existsSync(officeKey)
    ? {
        cert: fs.readFileSync(officeCert),
        key: fs.readFileSync(officeKey),
      }
    : undefined;

export default defineConfig({
  plugins: [react(), ...(httpsEnabled && !officeHttps ? [basicSsl()] : [])],
  server: {
    https: officeHttps ?? (httpsEnabled ? true : undefined),
    port: 3002,
    strictPort: true,
  },
  preview: {
    https: officeHttps ?? (httpsEnabled ? true : undefined),
    port: 3002,
  },
});
