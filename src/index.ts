import { Hono } from "hono";
import { checkDns } from "./controllers/dns-controller";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/checkDNS", checkDns);


export default app;
