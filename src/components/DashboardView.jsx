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
      .select('id, inicio, estado, monto, pagado, pacientes(nombre, apellido, obras_sociales(nombre))')
      .eq('profesional_id', profesional.profesionales.id)
      .gte('inicio', inicioMes)
      .lte('inicio', finMes)
      .order('inicio', { ascending: true }); // Ordenados por fecha para el Excel

    if (data) setTurnos(data);
  };

  // --- Función para exportar a CSV/Excel ---
  const exportarAExcel = () => {
    if (turnos.length === 0) return alert('No hay datos para exportar en este mes.');

    // 1. Definimos las cabeceras de las columnas
    const cabeceras = ['Fecha', 'Hora', 'Paciente', 'Obra Social', 'Estado', 'Monto ($)', 'Pagado'];

    // 2. Mapeamos los datos de los turnos a las columnas
    const filas = turnos.map(t => {
      const fecha = format(parseISO(t.inicio), 'dd/MM/yyyy');
      const hora = format(parseISO(t.inicio), 'HH:mm');
      const paciente = t.pacientes ? `${t.pacientes.nombre} ${t.pacientes.apellido}` : 'Desconocido';
      const obraSocial = t.pacientes?.obras_sociales?.nombre || 'Particular';
      const monto = t.monto || 0;
      const pagado = t.pagado ? 'Sí' : 'No';

      // Envolvemos las celdas en comillas para evitar problemas con comas en nombres
      return `"${fecha}","${hora}","${paciente}","${obraSocial}","${t.estado}","${monto}","${pagado}"`;
    });

    // 3. Unimos todo con saltos de línea y agregamos BOM para que Excel lea los acentos (UTF-8)
    const contenidoCSV = '\uFEFF' + cabeceras.join(',') + '\n' + filas.join('\n');

    // 4. Creamos el archivo y forzamos la descarga
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Turnos_${mesSeleccionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      <div className="text-center text-muted text-[0.9rem] font-semibold mb-6">
        Total de turnos registrados en el período: <strong className="text-violet-700">{totalTurnos}</strong>
      </div>

      {/* NUEVO BOTÓN: Exportar a Excel */}
      <button 
        onClick={exportarAExcel}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-glass_sec_bg border-[1.5px] border-violet-500 text-violet-900 font-extrabold text-[1.05rem] rounded-2xl shadow-sm hover:bg-violet-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Exportar Reporte a Excel
      </button>

    </div>
  );
}