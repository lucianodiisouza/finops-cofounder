package costing

import "time"

// Date é uma data sem hora, usada para início e término de serviços.
// Comparações de vigência precisam ignorar fuso e hora, por isso o tipo próprio.
type Date struct {
	Year  int
	Month time.Month
	Day   int
}

// NewDate normaliza um time.Time para uma data sem hora.
func NewDate(t time.Time) Date {
	return Date{Year: t.Year(), Month: t.Month(), Day: t.Day()}
}

// Time devolve a data como time.Time à meia-noite UTC.
func (d Date) Time() time.Time {
	return time.Date(d.Year, d.Month, d.Day, 0, 0, 0, 0, time.UTC)
}

// Before informa se d é anterior a other.
func (d Date) Before(other Date) bool { return d.Time().Before(other.Time()) }

// After informa se d é posterior a other.
func (d Date) After(other Date) bool { return d.Time().After(other.Time()) }
