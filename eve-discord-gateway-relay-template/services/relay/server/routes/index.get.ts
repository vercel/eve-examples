import { defineEventHandler, sendRedirect } from "nitro/h3";

export default defineEventHandler((event) => sendRedirect(event, "/relay/health", 307));
