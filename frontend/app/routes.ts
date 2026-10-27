import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/dashboard.tsx"),
  route("entrar", "routes/login.tsx"),
  route("projetos/:id", "routes/project.tsx"),
  route("evolucao", "routes/evolution.tsx"),
  route("cotacoes", "routes/rates.tsx"),
] satisfies RouteConfig;
