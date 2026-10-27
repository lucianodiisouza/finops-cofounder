import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, type User } from "./api";

/**
 * Resolve a sessão do usuário. Quando não há sessão válida, manda para o login.
 * Usado por todas as telas autenticadas.
 */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {
        if (active) navigate("/entrar", { replace: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  return { user, loading };
}
