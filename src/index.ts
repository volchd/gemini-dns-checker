import { Hono } from "hono";
import { checkDns } from "./controllers/dns-controller";
import { handleSpfRequest } from "./controllers/spf-controller";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/checkDNS", checkDns);
app.get("/spf", handleSpfRequest);


export default app;
