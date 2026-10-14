import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function DashboardView({ profesional }) {
  const [turnos, setTurnos] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    if (profesional) cargarReporteMes();
  }, [profesional, mesSeleccionado]);

  const cargarReporteMes = async () => {
    const inicioMes = startOfMonth(parseISO(`${mesSeleccionado}-01`)).toISOString();
    const finMes = endOfMonth(parseISO(`${mesSeleccionado}-01`)).toISOString();

    const { data } = await supabase
      .from('turnos')
      .select('id, inicio, estado, monto, pagado, pacientes(obras_sociales(nombre))')
      .eq('profesional_id', profesional.profesionales.id)
      .gte('inicio', inicioMes)
      .lte('inicio', finMes);

    if (data) setTurnos(data);
  };

  // --- Métricas Calculadas ---
  const totalTurnos = turnos.length;
  const atendidos = turnos.filter(t => t.estado === 'atendido').length;
  const ausentes = turnos.filter(t => t.estado === 'ausente').length;
  const cancelados = turnos.filter(t => t.estado === 'cancelado').length;
  
  const facturacionTotal = turnos.reduce((acc, t) => acc + (parseFloat(t.monto) || 0), 0);
  const facturacionCobrada = turnos.filter(t => t.pagado).reduce((acc, t) => acc + (parseFloat(t.monto) || 0), 0);

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg animate-fade-in pb-12">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight">Reportes y Métricas</h2>
          <p className="text-muted text-[0.95rem]">Resumen de actividad y financiero mensual.</p>
        </div>
        <input 
          type="month" 
          value={mesSeleccionado} 
          onChange={e => setMesSeleccionado(e.target.value)} 
          className="bg-field border border-line rounded-xl p-2.5 font-bold text-violet-900 focus:outline-none"
        />
      </div>

      {/* Tarjetas 3D Financieras */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 text-white rounded-[20px] p-4 shadow-[0_12px_25px_rgba(109,40,217,0.3)]">
          <span className="block text-[0.85rem] text-violet-200 font-bold uppercase tracking-wider">Facturación Total</span>
          <span className="block text-[1.8rem] font-extrabold mt-1">${facturacionTotal.toLocaleString()}</span>
        </div>
        <div className="bg-gradient-to-br from-[#7FA457] to-[#4C7536] text-white rounded-[20px] p-4 shadow-[0_12px_25px_rgba(76,117,54,0.3)]">
          <span className="block text-[0.85rem] text-[#E2F0D9] font-bold uppercase tracking-wider">Cobrado (Pagado)</span>
          <span className="block text-[1.8rem] font-extrabold mt-1">${facturacionCobrada.toLocaleString()}</span>
        </div>
      </div>

      {/* Gráfico de Barras Estilo 3D (Distribución de Estados) */}
      <div className="bg-field border border-line rounded-[20px] p-4 mb-5 shadow-sm">
        <h3 className="font-extrabold text-[1.1rem] text-ink mb-3">Estado de Turnos del Mes</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/80 border border-line rounded-2xl p-3 shadow-sm">
            <span className="block text-[1.4rem] font-extrabold text-violet-700">{atendidos}</span>
            <span className="text-[0.85rem] text-muted font-bold">Atendidos</span>
          </div>
          <div className="bg-white/80 border border-line rounded-2xl p-3 shadow-sm">
            <span className="block text-[1.4rem] font-extrabold text-[#7A4A00]">{ausentes}</span>
            <span className="text-[0.85rem] text-muted font-bold">Ausentes</span>
          </div>
          <div className="bg-white/80 border border-line rounded-2xl p-3 shadow-sm">
            <span className="block text-[1.4rem] font-extrabold text-[#4F4560]">{cancelados}</span>
            <span className="text-[0.85rem] text-muted font-bold">Cancelados</span>
          </div>
        </div>
      </div>

      <div className="text-center text-muted text-[0.9rem] font-semibold">
        Total de turnos registrados en el período: <strong className="text-violet-700">{totalTurnos}</strong>
      </div>
    </div>
  );
}