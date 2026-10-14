import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, addDays, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AgendaView({ profesional }) {
  const [turnos, setTurnos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [turnoEditar, setTurnoEditar] = useState(null);
  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  const dias = Array.from({ length: 14 })
    .map((_, i) => addDays(startOfToday(), i))
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6) 
    .slice(0, 5);

  useEffect(() => {
    if (profesional) cargarAgenda();
  }, [selectedDate, profesional]);

  const cargarAgenda = async () => {
    const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999);
    
    const { data } = await supabase
      .from('turnos')
      .select('id, inicio, estado, monto, pagado, pacientes(nombre, apellido, dni, telefono_wsp, obra_social_id, obras_sociales(nombre))')
      .eq('profesional_id', profesional.profesionales.id)
      .gte('inicio', startOfDay.toISOString())
      .lte('inicio', endOfDay.toISOString())
      .order('inicio', { ascending: true });
    
    if (data) setTurnos(data);
  };

  const cambiarEstado = async (turno, nuevoEstado) => {
    let updates = { estado: nuevoEstado };

    // Automatización de pago al atender
    if (nuevoEstado === 'atendido' && turno.estado !== 'atendido') {
      updates.pagado = true;
      if (!turno.monto || turno.monto === 0) {
        const osId = turno.pacientes?.obra_social_id;
        if (osId) {
          const { data: arancel } = await supabase
            .from('aranceles')
            .select('monto')
            .eq('profesional_id', profesional.profesionales.id)
            .eq('obra_social_id', osId)
            .maybeSingle();
          updates.monto = arancel?.monto || 0;
        }
      }
    }

    const { error } = await supabase.from('turnos').update(updates).eq('id', turno.id);
    if (!error) {
      setTurnos(turnos.map(t => t.id === turno.id ? { ...t, ...updates } : t));
      setTurnoEditar(null);
      mostrarMensaje('Estado y cobros actualizados.', 'exito');
    } else {
      mostrarMensaje('Error al actualizar el turno.', 'error');
    }
  };

  // Función para tocar el botón y cambiar de impago (rojo) a pagado (verde)
  const togglePago = async (turno) => {
    const nuevoPagado = !turno.pagado;
    const { error } = await supabase.from('turnos').update({ pagado: nuevoPagado }).eq('id', turno.id);
    if (!error) {
      setTurnos(turnos.map(t => t.id === turno.id ? { ...t, pagado: nuevoPagado } : t));
      setTurnoEditar({ ...turno, pagado: nuevoPagado });
    }
  };

  // Función para guardar el monto cuando terminas de escribir en el campo
  const actualizarMonto = async (turno, nuevoMonto) => {
    const { error } = await supabase.from('turnos').update({ monto: nuevoMonto }).eq('id', turno.id);
    if (!error) {
      setTurnos(turnos.map(t => t.id === turno.id ? { ...t, monto: nuevoMonto } : t));
    }
  };

  const getBadgeClass = (estado) => {
    const clases = { confirmado: 'bg-[#EDE3F8] text-[#4A2E70]', atendido: 'bg-[#DDEBCF] text-[#2F5420]', ausente: 'bg-[#FBE7C4] text-[#7A4A00]', cancelado: 'bg-[#E6E1EB] text-[#4F4560]' };
    return clases[estado] || clases.confirmado;
  };

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-[0_10px_30px_rgba(62,39,96,0.12)] animate-fade-in relative">
      
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Mi agenda</h2>
      <p className="text-muted capitalize mb-4">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</p>

      <div className="flex gap-[10px] overflow-x-auto pb-2 scrollbar-hide mb-4">
        {dias.map((dia, idx) => {
          const isSelected = dia.getTime() === selectedDate.getTime();
          return (
            <button key={idx} onClick={() => setSelectedDate(dia)} className={`shrink-0 min-w-[74px] py-[9px] px-[12px] rounded-2xl border-2 transition-colors ${isSelected ? 'bg-violet-700 border-violet-500 text-white' : 'bg-field border-line'}`}>
              <span className={`block text-[0.85rem] ${isSelected ? 'text-[#E7DAF5]' : 'text-muted'}`}>{idx === 0 ? 'hoy' : format(dia, 'EEE', { locale: es })}</span>
              <span className="block text-[1.3rem] font-extrabold">{format(dia, 'd')}</span>
            </button>
          );
        })}
      </div>

      <ul className="grid gap-[10px]">
        {turnos.length === 0 ? <p className="text-muted py-2 font-bold">No tenés turnos este día.</p> : turnos.map((turno) => (
          <li key={turno.id}>
            <button onClick={() => setTurnoEditar(turno)} className="w-full flex items-center gap-[14px] bg-field border-[1.5px] border-line rounded-[18px] p-[12px_14px] min-h-[68px] hover:border-violet-500 text-left transition-colors cursor-pointer">
              <span className={`shrink-0 font-extrabold text-[1.15rem] min-w-[58px] ${turno.estado === 'cancelado' ? 'text-muted line-through' : 'text-violet-700'}`}>
                {format(new Date(turno.inicio), 'HH:mm')}
              </span>
              <span className="flex-1 min-w-0">
                <strong className={`block font-extrabold leading-[1.25] text-ink truncate ${turno.estado === 'cancelado' ? 'line-through opacity-70' : ''}`}>
                  {turno.pacientes?.nombre} {turno.pacientes?.apellido}
                </strong>
                <small className="block text-[0.9rem] text-muted truncate">
                   {turno.pacientes?.obras_sociales?.nombre || 'Particular'} 
                   {turno.monto > 0 ? ` · $${turno.monto}` : ''}
                </small>
              </span>
              <span className={`shrink-0 text-[0.85rem] font-extrabold px-[10px] py-[4px] rounded-full ${getBadgeClass(turno.estado)}`}>{turno.estado}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* MODAL CON OPCIONES DE COBRO Y ESTADO */}
      {turnoEditar && (
        <div className="fixed inset-0 z-[60] bg-violet-900/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[24px] p-6 shadow-xl w-full max-w-[340px] animate-fade-in text-center">
            <h3 className="font-extrabold text-violet-700 text-[1.2rem] mb-1">Detalle del turno</h3>
            <p className="font-bold text-ink mb-1">{turnoEditar.pacientes?.nombre} {turnoEditar.pacientes?.apellido}</p>
            <p className="text-muted text-[0.9rem] mb-4 capitalize">{format(new Date(turnoEditar.inicio), "EEEE d 'de' MMMM - HH:mm 'h'", { locale: es })}</p>
            
            {/* Panel de Cobro */}
            <div className="flex items-center justify-between gap-2 mb-4 p-3 bg-field border border-line rounded-[16px]">
                <div className="flex items-center gap-2">
                   <button onClick={() => togglePago(turnoEditar)} className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold transition-colors ${turnoEditar.pagado ? 'bg-[#4C7536]' : 'bg-[#B3261E]'}`}>
                      {turnoEditar.pagado ? '✓' : '✗'}
                   </button>
                   <span className="font-bold text-[0.9rem] text-ink">{turnoEditar.pagado ? 'Abonado' : 'Pendiente'}</span>
                </div>
                <div className="flex items-center gap-1">
                   <span className="font-bold text-muted">$</span>
                   <input 
                     type="number" 
                     value={turnoEditar.monto || ''}
                     onChange={(e) => setTurnoEditar({...turnoEditar, monto: e.target.value})}
                     onBlur={(e) => actualizarMonto(turnoEditar, e.target.value)}
                     className="w-20 bg-white border border-line rounded-lg p-1.5 font-bold text-ink focus:outline-none text-center"
                   />
                </div>
            </div>

            <div className="grid gap-2 mb-4">
              <button onClick={() => cambiarEstado(turnoEditar, 'confirmado')} className={`py-3 rounded-[14px] font-bold border-2 transition-all ${turnoEditar.estado === 'confirmado' ? 'bg-[#EDE3F8] border-[#4A2E70] text-[#4A2E70] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Confirmado</button>
              <button onClick={() => cambiarEstado(turnoEditar, 'atendido')} className={`py-3 rounded-[14px] font-bold border-2 transition-all ${turnoEditar.estado === 'atendido' ? 'bg-[#DDEBCF] border-[#2F5420] text-[#2F5420] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Atendido</button>
              <button onClick={() => cambiarEstado(turnoEditar, 'ausente')} className={`py-3 rounded-[14px] font-bold border-2 transition-all ${turnoEditar.estado === 'ausente' ? 'bg-[#FBE7C4] border-[#7A4A00] text-[#7A4A00] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>No vino</button>
              <button onClick={() => cambiarEstado(turnoEditar, 'cancelado')} className={`py-3 rounded-[14px] font-bold border-2 transition-all ${turnoEditar.estado === 'cancelado' ? 'bg-[#E6E1EB] border-[#4F4560] text-[#4F4560] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Cancelado</button>
            </div>
            
            <button onClick={() => setTurnoEditar(null)} className="w-full py-3 rounded-[14px] font-bold bg-glass_sec_bg text-violet-900 border border-line hover:bg-line transition-colors">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}