package handler

import "log/slog"

// slogDeleteSessionFailure registra a falha ao apagar a sessão sem interromper o logout:
// o cookie é limpo de qualquer forma, então o usuário sai mesmo assim.
func slogDeleteSessionFailure(err error) {
	slog.Warn("não foi possível apagar a sessão no banco", "err", err)
}
