import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- NUEVO: Importamos el componente de Horarios ---
import HorariosView from './HorariosView';

export default function SecretariaView() {
  const [activeTab, setActiveTab] = useState('agenda');
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [filtroProf, setFiltroProf] = useState('todas');
  
  const [turnos, setTurnos] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [nuevaObra, setNuevaObra] = useState('');
  
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const [modoPaciente, setModoPaciente] = useState('existente'); 
  const [busquedaTurno, setBusquedaTurno] = useState('');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [formNuevo, setFormNuevo] = useState({ nombre: '', apellido: '', dni: '', tel: '', obraSocialId: '', afiliado: '' });
  
  const [turnoSpecs, setTurnoSpecs] = useState({ especialidadId: '', dia: startOfToday(), slot: null });
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [errorTurno, setErrorTurno] = useState('');
  const [turnoEditar, setTurnoEditar] = useState(null);
  const [pacienteEditar, setPacienteEditar] = useState(null);

  const [duracionTurno, setDuracionTurno] = useState(30);
  
  const [nuevoHorario, setNuevoHorario] = useState('');

  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  const dias = Array.from({ length: 7 })
    .map((_, i) => addDays(startOfToday(), i))
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6) 
    .slice(0, 5);

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  useEffect(() => {
    if (activeTab === 'agenda') cargarAgendaDia(selectedDate);
  }, [selectedDate, activeTab]);

  const cargarDatosGenerales = async () => {
    const [resProf, resObras, resPac] = await Promise.all([
      supabase.from('profesionales').select('*'),
      supabase.from('obras_sociales').select('*').order('nombre'),
      supabase.from('pacientes').select('*, obras_sociales(nombre)').order('nombre')
    ]);
    if (resProf.data) setProfesionales(resProf.data);
    if (resObras.data) setObrasSociales(resObras.data);
    if (resPac.data) setPacientes(resPac.data);
  };

  const cargarAgendaDia = async (date) => {
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('turnos')
      .select('id, inicio, fin, estado, pagado, monto, profesional_id, pacientes(nombre, apellido, dni, telefono_wsp, obra_social_id, obras_sociales(nombre))')
      .gte('inicio', startOfDay.toISOString())
      .lte('inicio', endOfDay.toISOString())
      .order('inicio', { ascending: true });

    if (data) setTurnos(data);
  };

  const cambiarEstadoTurno = async (id, nuevoEstado) => {
    const estaPagado = nuevoEstado === 'atendido';

    let updates = { 
      estado: nuevoEstado, 
      pagado: estaPagado 
    };

    if (nuevoEstado === 'atendido') {
      const profId = turnoEditar.profesional_id;
      const osId = turnoEditar.pacientes?.obra_social_id || null;

      let query = supabase.from('aranceles').select('monto').eq('profesional_id', profId);
      
      if (osId) {
        query = query.eq('obra_social_id', osId);
      } else {
        query = query.is('obra_social_id', null);
      }

      const { data: arancel } = await query.maybeSingle();
      updates.monto = arancel?.monto || 0;
      
    } else {
      updates.monto = 0;
    }

    const { error } = await supabase.from('turnos').update(updates).eq('id', id);

    if (!error) {
      setTurnos(turnos.map(t => t.id === id ? { ...t, ...updates } : t));
      setTurnoEditar(null);
      mostrarMensaje('Estado y cobros actualizados.', 'exito');
    } else {
      mostrarMensaje('Error al actualizar el turno.', 'error');
    }
  };

  const guardarNuevoHorario = async () => {
    if (!nuevoHorario) return;

    const fechaBase = new Date(turnoEditar.inicio);
    const [horas, minutos] = nuevoHorario.split(':');
    
    const nuevoInicio = new Date(fechaBase);
    nuevoInicio.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);

    const inicioOriginal = new Date(turnoEditar.inicio).getTime();
    const finOriginal = new Date(turnoEditar.fin).getTime();
    const duracionMs = finOriginal - inicioOriginal;

    const nuevoFin = new Date(nuevoInicio.getTime() + (duracionMs > 0 ? duracionMs : 30 * 60000));

    const { error } = await supabase
      .from('turnos')
      .update({ inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString() })
      .eq('id', turnoEditar.id);

    if (!error) {
      setTurnos(turnos.map(t => t.id === turnoEditar.id ? { ...t, inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString() } : t).sort((a, b) => new Date(a.inicio) - new Date(b.inicio)));
      setTurnoEditar(prev => ({ ...prev, inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString() }));
      mostrarMensaje('Horario modificado con éxito.', 'exito');
    } else {
      mostrarMensaje('Error: el horario puede estar chocando con otro turno.', 'error');
    }
  };

  const enviarWhatsApp = (tipo) => {
    const telefono = turnoEditar.pacientes?.telefono_wsp;
    if (!telefono) {
      return mostrarMensaje('El paciente no tiene un WhatsApp registrado.', 'error');
    }

    const numeroLimpio = telefono.replace(/\D/g, ''); 
    const paciente = turnoEditar.pacientes?.nombre;
    const especialidad = turnoEditar.profesionalObj?.especialidad?.replace('_', ' ');
    const profesional = `${turnoEditar.profesionalObj?.nombre} ${turnoEditar.profesionalObj?.apellido}`;
    const fecha = format(new Date(turnoEditar.inicio), "EEEE d 'de' MMMM", { locale: es });
    const hora = format(new Date(turnoEditar.inicio), "HH:mm");
    
    let mensaje = '';
    if (tipo === 'confirmacion') {
      mensaje = `Hola ${paciente}, tu turno de ${especialidad} con la Dra. ${profesional} quedó confirmado para el ${fecha} a las ${hora} h. Si no podés venir, avisanos por este medio.`;
    } else {
      mensaje = `Hola ${paciente}, te recordamos tu turno de ${especialidad} con la Dra. ${profesional} para el ${fecha} a las ${hora} h. Si no podés asistir, avisanos por este medio.`;
    }

    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const agregarObraSocial = async () => {
    if (!nuevaObra.trim()) return;
    const { data } = await supabase.from('obras_sociales').insert([{ nombre: nuevaObra, activa: true }]).select().single();
    if (data) {
      setObrasSociales([...obrasSociales, data]);
      setNuevaObra('');
      mostrarMensaje('Obra social agregada.', 'exito');
    }
  };

  const toggleObraSocial = async (id, estadoActual) => {
    await supabase.from('obras_sociales').update({ activa: !estadoActual }).eq('id', id);
    setObrasSociales(prev => prev.map(o => o.id === id ? { ...o, activa: !estadoActual } : o));
  };

  useEffect(() => {
    if (turnoSpecs.especialidadId && turnoSpecs.dia) {
      buscarHorariosDisponibles();
    }
  }, [turnoSpecs.especialidadId, turnoSpecs.dia]);

  const buscarHorariosDisponibles = async () => {
    setBuscandoHorarios(true);
    setTurnoSpecs(prev => ({ ...prev, slot: null }));
    const { data } = await supabase.rpc('horarios_libres', {
      p_profesional: turnoSpecs.especialidadId,
      p_fecha: format(turnoSpecs.dia, 'yyyy-MM-dd')
    });
    if (data) setHorariosDisponibles(data);
    setBuscandoHorarios(false);
  };

  const guardarTurnoManual = async () => {
    setErrorTurno('');
    let pacienteId = null;

    if (modoPaciente === 'existente') {
      if (!pacienteSeleccionado) return setErrorTurno('Buscá y seleccioná un paciente.');
      pacienteId = pacienteSeleccionado.id;
    } else {
      if (formNuevo.nombre.length < 2 || formNuevo.apellido.length < 2 || !formNuevo.dni) {
        return setErrorTurno('Completá al menos nombre, apellido y DNI.');
      }
      const osIdInt = parseInt(formNuevo.obraSocialId, 10);
      const { data: nuevoPac, error: errPac } = await supabase.from('pacientes').insert([{
        dni: formNuevo.dni.replace(/\D/g, ''),
        nombre: formNuevo.nombre,
        apellido: formNuevo.apellido,
        telefono_wsp: formNuevo.tel,
        obra_social_id: osIdInt || null,
        nro_afiliado: formNuevo.afiliado,
        consentimiento_datos_at: new Date().toISOString()
      }]).select().single();
      
      if (errPac) return setErrorTurno('Error al crear el paciente. Revisá si el DNI ya existe.');
      pacienteId = nuevoPac.id;
      setPacientes([...pacientes, { ...nuevoPac, obras_sociales: { nombre: obrasSociales.find(o => o.id === osIdInt)?.nombre } }]);
    }

    if (!turnoSpecs.especialidadId || !turnoSpecs.slot) return setErrorTurno('Elegí una especialidad y un horario libre.');

    const fechaInicio = new Date(turnoSpecs.slot.inicio);
    const fechaFin = new Date(fechaInicio.getTime() + duracionTurno * 60000);

    const { error: errTurno } = await supabase.from('turnos').insert([{
      profesional_id: turnoSpecs.especialidadId,
      paciente_id: pacienteId,
      inicio: fechaInicio.toISOString(),
      fin: fechaFin.toISOString(),
      origen: 'web',
      estado: 'confirmado'
    }]);

    if (errTurno) return setErrorTurno('Error al guardar. Ese horario acaba de ser ocupado o la franja larga se superpone con otro turno.');

    mostrarMensaje('¡Turno guardado con éxito!', 'exito');
    setModoPaciente('existente');
    setPacienteSeleccionado(null);
    setBusquedaTurno('');
    setFormNuevo({ nombre: '', apellido: '', dni: '', tel: '', obraSocialId: '', afiliado: '' });
    setTurnoSpecs({ especialidadId: '', dia: startOfToday(), slot: null });
    setDuracionTurno(30); 
    setActiveTab('agenda');
    setSelectedDate(turnoSpecs.dia); 
  };
  
  const guardarCambiosPaciente = async (e) => {
    e.preventDefault();
    const osIdInt = pacienteEditar.obra_social_id ? parseInt(pacienteEditar.obra_social_id, 10) : null;

    const { error } = await supabase
      .from('pacientes')
      .update({
        nombre: pacienteEditar.nombre,
        apellido: pacienteEditar.apellido,
        dni: pacienteEditar.dni,
        telefono_wsp: pacienteEditar.telefono_wsp,
        obra_social_id: osIdInt,
        nro_afiliado: pacienteEditar.nro_afiliado
      })
      .eq('id', pacienteEditar.id);

    if (!error) {
      mostrarMensaje('Datos de paciente actualizados.', 'exito');
      setPacienteEditar(null);
      cargarDatosGenerales();
    } else {
      mostrarMensaje('Error al actualizar paciente.', 'error');
    }
  };

  const turnosFiltrados = turnos.filter(t => filtroProf === 'todas' || t.profesional_id === filtroProf);
  
  const pacientesFiltrados = pacientes.filter(p => {
    const termino = busqueda.toLowerCase();
    return p.nombre?.toLowerCase().includes(termino) || 
           p.apellido?.toLowerCase().includes(termino) || 
           p.dni?.includes(termino);
  });

  const resultadosBusquedaTurno = busquedaTurno.length > 1 ? pacientes.filter(p => {
    const termino = busquedaTurno.toLowerCase();
    return p.nombre?.toLowerCase().includes(termino) || 
           p.apellido?.toLowerCase().includes(termino) || 
           p.dni?.includes(termino);
  }).slice(0, 5) : [];

  const getBadgeClass = (estado) => {
    const clases = { confirmado: 'bg-[#EDE3F8] text-[#4A2E70]', atendido: 'bg-[#DDEBCF] text-[#2F5420]', ausente: 'bg-[#FBE7C4] text-[#7A4A00]', cancelado: 'bg-[#E6E1EB] text-[#4F4560]' };
    return clases[estado] || clases.confirmado;
  };

  return (
    <div className="animate-fade-in relative z-10 flex-1 pb-24">
      
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      {/* ================= VISTA: AGENDA GENERAL ================= */}
      {activeTab === 'agenda' && (
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg">
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Agenda general</h2>
          <p className="text-muted capitalize mb-4">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</p>

          <div className="flex gap-[10px] overflow-x-auto pb-2 scrollbar-hide mb-3">
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

          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setFiltroProf('todas')} className={`px-4 py-2 rounded-full font-bold text-[0.9rem] border-2 transition-colors ${filtroProf === 'todas' ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>Todas</button>
            {profesionales.map(p => (
              <button key={p.id} onClick={() => setFiltroProf(p.id)} className={`capitalize px-4 py-2 rounded-full font-bold text-[0.9rem] border-2 transition-colors ${filtroProf === p.id ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>
                {p.especialidad.replace('_', ' ')}
              </button>
            ))}
          </div>

          <ul className="grid gap-[10px]">
            {turnosFiltrados.length === 0 ? <p className="text-muted py-2 font-bold">No hay turnos para esta vista.</p> : turnosFiltrados.map((turno) => {
               const prof = profesionales.find(p => p.id === turno.profesional_id);
               return (
                <li key={turno.id}>
                  <button onClick={() => { setTurnoEditar({...turno, profesionalObj: prof}); setNuevoHorario(format(new Date(turno.inicio), 'HH:mm')); }} className="w-full flex items-center gap-[14px] bg-field border-[1.5px] border-line rounded-[18px] p-[12px_14px] min-h-[68px] hover:border-violet-500 cursor-pointer text-left transition-colors">
                    <span className={`shrink-0 font-extrabold text-[1.15rem] min-w-[58px] ${turno.estado === 'cancelado' ? 'text-muted line-through' : 'text-violet-700'}`}>{format(new Date(turno.inicio), 'HH:mm')}</span>
                    <span className="flex-1 min-w-0">
                      <strong className={`block font-extrabold leading-[1.25] text-ink truncate ${turno.estado === 'cancelado' ? 'line-through opacity-70' : ''}`}>{turno.pacientes?.nombre} {turno.pacientes?.apellido}</strong>
                      <small className="block text-[0.9rem] text-muted capitalize">{prof?.especialidad ? prof.especialidad.replace('_', ' ') : 'Cargando...'}</small>
                    </span>
                    <span className={`shrink-0 text-[0.85rem] font-extrabold px-[10px] py-[4px] rounded-full ${getBadgeClass(turno.estado)}`}>{turno.estado}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ================= MODAL EDICIÓN Y WHATSAPP (SECRETARIA) ================= */}
      {turnoEditar && (
        <div className="fixed inset-0 z-[60] bg-violet-900/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[24px] p-6 shadow-xl w-full max-w-[360px] animate-fade-in text-center">
            
            <h3 className="font-extrabold text-violet-700 text-[1.2rem] mb-1">Gestión del turno</h3>
            <p className="font-bold text-ink mb-1">{turnoEditar.pacientes?.nombre} {turnoEditar.pacientes?.apellido}</p>
            <p className="text-muted text-[0.9rem] mb-1 capitalize">{format(new Date(turnoEditar.inicio), "EEEE d 'de' MMMM - HH:mm 'h'", { locale: es })}</p>
            <p className="text-muted text-[0.85rem] font-bold mb-4 uppercase tracking-wider">{turnoEditar.profesionalObj?.especialidad?.replace('_', ' ')}</p>
            
            <div className="bg-[#DCF8C6]/30 border border-[#DCF8C6] rounded-[16px] p-3 mb-4">
               <p className="text-[0.85rem] font-bold text-[#2F5420] mb-2 flex items-center justify-center gap-1.5">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                 Notificar al paciente
               </p>
               <div className="flex gap-2">
                 <button onClick={() => enviarWhatsApp('confirmacion')} className="flex-1 py-2.5 bg-[#25D366] text-white rounded-[12px] font-bold text-[0.85rem] shadow-sm hover:-translate-y-0.5 transition-transform">Confirmación</button>
                 <button onClick={() => enviarWhatsApp('recordatorio')} className="flex-1 py-2.5 bg-[#128C7E] text-white rounded-[12px] font-bold text-[0.85rem] shadow-sm hover:-translate-y-0.5 transition-transform">Recordatorio</button>
               </div>
            </div>

            <div className="bg-field border border-line rounded-[16px] p-3 mb-4">
              <label className="block text-[0.85rem] font-bold text-ink mb-2">Modificar horario</label>
              <div className="flex gap-2">
                <input 
                  type="time" 
                  value={nuevoHorario}
                  onChange={(e) => setNuevoHorario(e.target.value)}
                  className="flex-1 bg-white border border-line rounded-[12px] p-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <button 
                  onClick={guardarNuevoHorario}
                  className="px-4 bg-violet-100 text-violet-700 font-bold rounded-[12px] hover:bg-violet-200 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => cambiarEstadoTurno(turnoEditar.id, 'confirmado')} className={`py-2.5 rounded-[12px] font-bold border-2 transition-all text-[0.9rem] ${turnoEditar.estado === 'confirmado' ? 'bg-[#EDE3F8] border-[#4A2E70] text-[#4A2E70] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Confirmado</button>
              <button onClick={() => cambiarEstadoTurno(turnoEditar.id, 'atendido')} className={`py-2.5 rounded-[12px] font-bold border-2 transition-all text-[0.9rem] ${turnoEditar.estado === 'atendido' ? 'bg-[#DDEBCF] border-[#2F5420] text-[#2F5420] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Atendido</button>
              <button onClick={() => cambiarEstadoTurno(turnoEditar.id, 'ausente')} className={`py-2.5 rounded-[12px] font-bold border-2 transition-all text-[0.9rem] ${turnoEditar.estado === 'ausente' ? 'bg-[#FBE7C4] border-[#7A4A00] text-[#7A4A00] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>No vino</button>
              <button onClick={() => cambiarEstadoTurno(turnoEditar.id, 'cancelado')} className={`py-2.5 rounded-[12px] font-bold border-2 transition-all text-[0.9rem] ${turnoEditar.estado === 'cancelado' ? 'bg-[#E6E1EB] border-[#4F4560] text-[#4F4560] shadow-sm' : 'bg-field border-line text-muted hover:border-violet-500'}`}>Cancelado</button>
            </div>
            
            <button onClick={() => setTurnoEditar(null)} className="w-full py-3 rounded-[14px] font-bold bg-glass_sec_bg text-violet-900 border border-line hover:bg-line transition-colors">Volver</button>
          </div>
        </div>
      )}

      {/* ================= VISTA: NUEVO TURNO MANUAL ================= */}
      {activeTab === 'nuevo' && (
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg">
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Nuevo turno</h2>
          <p className="text-muted mb-4">Para pacientes que llaman o vienen al consultorio.</p>
          
          <div className="flex gap-2 mb-5">
            <button onClick={() => {setModoPaciente('existente'); setErrorTurno('');}} className={`flex-1 py-2.5 rounded-[14px] font-bold border-2 transition-colors ${modoPaciente === 'existente' ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>Paciente existente</button>
            <button onClick={() => {setModoPaciente('nuevo'); setErrorTurno('');}} className={`flex-1 py-2.5 rounded-[14px] font-bold border-2 transition-colors ${modoPaciente === 'nuevo' ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>Paciente nuevo</button>
          </div>

          {modoPaciente === 'existente' && (
            <div className="mb-5 animate-fade-in">
              <label className="block font-bold mb-1.5">Buscar por nombre o DNI</label>
              <input type="search" value={busquedaTurno} onChange={e => {setBusquedaTurno(e.target.value); setPacienteSeleccionado(null);}} placeholder="Ej: Perez" className="w-full bg-field border-[1.5px] border-line rounded-[14px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
              
              {!pacienteSeleccionado && busquedaTurno.length > 1 && (
                <ul className="mt-2 grid gap-1.5">
                  {resultadosBusquedaTurno.length === 0 ? <p className="text-muted font-bold px-2 text-[0.9rem]">No encontrado. Cargalo como "Paciente nuevo".</p> : resultadosBusquedaTurno.map(p => (
                    <li key={p.id}>
                      <button onClick={() => setPacienteSeleccionado(p)} className="w-full text-left p-3 rounded-[12px] bg-field border border-line hover:border-violet-500">
                        <strong className="block">{p.nombre} {p.apellido}</strong>
                        <span className="text-[0.85rem] text-muted">DNI {p.dni} · {p.obras_sociales?.nombre || 'Particular'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pacienteSeleccionado && (
                <div className="mt-2 p-3 bg-sel-bg border-[1.5px] border-violet-500 rounded-[14px] font-bold text-violet-900 bg-[#F3ECF9]">
                  ✓ Seleccionado: {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
                </div>
              )}
            </div>
          )}

          {modoPaciente === 'nuevo' && (
            <div className="mb-5 grid gap-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold mb-1">Nombre</label><input type="text" value={formNuevo.nombre} onChange={e=>setFormNuevo({...formNuevo, nombre: e.target.value})} className="w-full bg-field border border-line rounded-[12px] p-2.5" /></div>
                <div><label className="block font-bold mb-1">Apellido</label><input type="text" value={formNuevo.apellido} onChange={e=>setFormNuevo({...formNuevo, apellido: e.target.value})} className="w-full bg-field border border-line rounded-[12px] p-2.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold mb-1">DNI</label><input type="tel" value={formNuevo.dni} onChange={e=>setFormNuevo({...formNuevo, dni: e.target.value})} className="w-full bg-field border border-line rounded-[12px] p-2.5" /></div>
                <div><label className="block font-bold mb-1">WhatsApp</label><input type="tel" value={formNuevo.tel} onChange={e=>setFormNuevo({...formNuevo, tel: e.target.value})} className="w-full bg-field border border-line rounded-[12px] p-2.5" /></div>
              </div>
              <div>
                <label className="block font-bold mb-1">Obra Social</label>
                <select value={formNuevo.obraSocialId} onChange={e=>setFormNuevo({...formNuevo, obraSocialId: e.target.value, afiliado: ''})} className="w-full bg-field border border-line rounded-[12px] p-2.5">
                  <option value="">Elegí una opción</option>
                  {obrasSociales.filter(o => o.activa).map(os => <option key={os.id} value={os.id}>{os.nombre}</option>)}
                </select>
              </div>
              {obrasSociales.find(o => o.id.toString() === formNuevo.obraSocialId)?.nombre !== 'Particular' && formNuevo.obraSocialId && (
                <div><label className="block font-bold mb-1">N.º Afiliado</label><input type="text" value={formNuevo.afiliado} onChange={e=>setFormNuevo({...formNuevo, afiliado: e.target.value})} className="w-full bg-field border border-line rounded-[12px] p-2.5" /></div>
              )}
            </div>
          )}

          <div className="h-[1px] bg-line my-4"></div>

          <div className="mb-4">
            <label className="block font-bold mb-1.5">Especialidad (Doctora)</label>
            <select value={turnoSpecs.especialidadId} onChange={e => setTurnoSpecs({...turnoSpecs, especialidadId: e.target.value, slot: null})} className="w-full bg-field border-[1.5px] border-line rounded-[14px] p-3">
              <option value="">Elegí una doctora</option>
              {profesionales.map(p => <option key={p.id} value={p.id}>{p.especialidad.replace('_', ' ')} · {p.nombre} {p.apellido}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <label className="block font-bold mb-1.5">Día del turno</label>
            <div className="flex gap-[10px] overflow-x-auto pb-2 scrollbar-hide">
              {dias.map((dia, idx) => {
                const isSelected = turnoSpecs.dia?.getTime() === dia.getTime();
                return (
                  <button key={idx} onClick={() => setTurnoSpecs({...turnoSpecs, dia: dia, slot: null})} className={`shrink-0 min-w-[72px] py-[8px] px-[10px] rounded-[14px] border-2 transition-colors ${isSelected ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>
                    <span className={`block text-[0.85rem] ${isSelected ? 'text-[#E7DAF5]' : 'text-muted'}`}>{format(dia, 'EEE', { locale: es })}</span>
                    <span className="block text-[1.2rem] font-extrabold">{format(dia, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-bold mb-1.5">Duración de la consulta</label>
            <div className="flex gap-2">
              <button onClick={() => setDuracionTurno(30)} className={`flex-1 py-2.5 rounded-[12px] font-bold border-2 transition-colors ${duracionTurno === 30 ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>Normal (30 min)</button>
              <button onClick={() => setDuracionTurno(60)} className={`flex-1 py-2.5 rounded-[12px] font-bold border-2 transition-colors ${duracionTurno === 60 ? 'bg-[#7FA457] border-[#7FA457] text-white' : 'bg-field border-line text-ink'}`}>Práctica (1 hora)</button>
            </div>
          </div>

          <div className="mb-2">
            <label className="block font-bold mb-1.5">Horarios Libres</label>
            {!turnoSpecs.especialidadId ? (
              <p className="text-muted text-[0.9rem]">Elegí una doctora para ver sus horarios.</p>
            ) : buscandoHorarios ? (
              <p className="text-muted font-bold">Buscando disponibilidad...</p>
            ) : horariosDisponibles.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {horariosDisponibles.map((slot, i) => {
                  const isSelected = turnoSpecs.slot?.inicio === slot.inicio;
                  return (
                    <button key={i} onClick={() => setTurnoSpecs({...turnoSpecs, slot: slot})} className={`py-2 px-1 rounded-[12px] font-bold border-2 transition-colors ${isSelected ? 'bg-violet-700 border-violet-700 text-white' : 'bg-field border-line text-ink'}`}>
                      {format(parseISO(slot.inicio), 'HH:mm')}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted text-[0.9rem]">No quedan turnos libres este día.</p>
            )}
          </div>

          {errorTurno && <p className="text-[#B3261E] font-bold mt-4 animate-pulse">{errorTurno}</p>}

          <button onClick={guardarTurnoManual} className="w-full mt-6 text-white font-extrabold text-[1.05rem] py-3.5 rounded-2xl bg-gradient-to-b from-[#7FA457] to-[#4C7536] shadow-md hover:-translate-y-0.5 transition-transform">
            Guardar turno
          </button>
        </div>
      )}

      {/* ================= VISTA: PACIENTES ================= */}
      {activeTab === 'pacientes' && (
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg">
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Pacientes</h2>
          <p className="text-muted mb-3.5">Buscá y editá los datos de contacto o cobertura.</p>
          
          <div className="mb-3.5">
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o DNI" className="w-full bg-field border-[1.5px] border-line rounded-[14px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
          </div>
          <div className="text-muted font-semibold mb-2.5">{pacientesFiltrados.length} pacientes</div>
          
          <ul className="grid gap-2.5">
            {pacientesFiltrados.length === 0 ? <p className="text-muted py-2">No se encontraron pacientes.</p> : pacientesFiltrados.map(p => (
              <li key={p.id} className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-field border-[1.5px] border-line rounded-[18px] p-3 transition-colors hover:border-violet-300">
                <div className="flex-1 min-w-0">
                  <strong className="block font-extrabold leading-[1.25] text-ink truncate">{p.nombre} {p.apellido}</strong>
                  <span className="block text-[0.9rem] text-muted mt-0.5">DNI: {p.dni} · WhatsApp: {p.telefono_wsp}</span>
                  <span className="block text-[0.85rem] font-bold text-violet-700 mt-1">
                    {p.obras_sociales?.nombre || 'Particular'} {p.nro_afiliado ? `- Afiliado: ${p.nro_afiliado}` : ''}
                  </span>
                </div>
                <button 
                  onClick={() => setPacienteEditar({ ...p, obra_social_id: p.obra_social_id || '' })}
                  className="shrink-0 px-4 py-2 bg-white border border-line text-violet-900 font-bold rounded-[14px] hover:bg-mist transition-colors shadow-sm"
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================= MODAL: EDICIÓN DE PACIENTE (SECRETARIA) ================= */}
      {pacienteEditar && (
        <div className="fixed inset-0 z-[70] bg-violet-900/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[24px] p-6 shadow-xl w-full max-w-[380px] animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-violet-700 text-[1.4rem] mb-4">Editar Paciente</h3>
            
            <form onSubmit={guardarCambiosPaciente} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-[0.9rem]">Nombre</label>
                  <input type="text" value={pacienteEditar.nombre} onChange={e => setPacienteEditar({...pacienteEditar, nombre: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-[0.9rem]">Apellido</label>
                  <input type="text" value={pacienteEditar.apellido} onChange={e => setPacienteEditar({...pacienteEditar, apellido: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                </div>
              </div>
              
              <div>
                <label className="block font-bold mb-1 text-[0.9rem]">DNI</label>
                <input type="tel" value={pacienteEditar.dni} onChange={e => setPacienteEditar({...pacienteEditar, dni: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
              </div>

              <div>
                <label className="block font-bold mb-1 text-[0.9rem]">WhatsApp</label>
                <input type="tel" value={pacienteEditar.telefono_wsp} onChange={e => setPacienteEditar({...pacienteEditar, telefono_wsp: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
              </div>

              <div>
                <label className="block font-bold mb-1 text-[0.9rem]">Obra Social</label>
                <select value={pacienteEditar.obra_social_id} onChange={e => setPacienteEditar({...pacienteEditar, obra_social_id: e.target.value, nro_afiliado: ''})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Particular / Ninguna</option>
                  {obrasSociales.map(os => (
                    <option key={os.id} value={os.id}>{os.nombre}</option>
                  ))}
                </select>
              </div>

              {pacienteEditar.obra_social_id && obrasSociales.find(o => o.id.toString() === pacienteEditar.obra_social_id.toString())?.nombre !== 'Particular' && (
                <div className="animate-fade-in">
                  <label className="block font-bold mb-1 text-[0.9rem]">Nro de Afiliado</label>
                  <input type="text" value={pacienteEditar.nro_afiliado || ''} onChange={e => setPacienteEditar({...pacienteEditar, nro_afiliado: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setPacienteEditar(null)} className="flex-1 py-3 rounded-xl font-bold bg-glass_sec_bg text-violet-900 border border-line hover:bg-mist">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-violet-700 text-white shadow-md hover:bg-violet-800">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= NUEVA VISTA: HORARIOS (Para Secretaria) ================= */}
      {activeTab === 'horarios' && (
        <HorariosView profesional={{ rol: 'secretaria' }} />
      )}

      {/* ================= VISTA: AJUSTES ================= */}
      {activeTab === 'ajustes' && (
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg">
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Ajustes</h2>
          <h3 className="font-extrabold text-[1.1rem] mt-4">Obras sociales</h3>
          <p className="text-[0.95rem] text-muted mb-3">Tocá una para ocultarla del formulario o volver a mostrarla.</p>
          
          <div className="flex flex-wrap gap-2 mb-4 mt-2">
            {obrasSociales.map(os => (
              <button key={os.id} onClick={() => toggleObraSocial(os.id, os.activa)} className={`px-4 py-2 rounded-full font-bold text-[0.9rem] border-2 transition-colors ${os.activa ? 'bg-[#DDEBCF] text-[#2F5420] border-transparent' : 'bg-[#E6E1EB] text-[#4F4560] line-through border-transparent'}`}>
                {os.nombre}
              </button>
            ))}
          </div>

          <label className="block font-bold mb-1.5">Agregar obra social</label>
          <div className="flex gap-2">
            <input type="text" value={nuevaObra} onChange={e => setNuevaObra(e.target.value)} className="flex-1 bg-field border-[1.5px] border-line rounded-[14px] p-3 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Ej: OSDE" />
            <button onClick={agregarObraSocial} className="px-6 rounded-[14px] font-extrabold text-white bg-gradient-to-b from-violet-500 to-violet-700 shadow-md">Agregar</button>
          </div>
        </div>
      )}

      {/* Menú Inferior Secretaría */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex bg-surface backdrop-blur-lg border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 w-full max-w-[760px] mx-auto p-2 gap-1.5 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('agenda')} className={`py-3 px-1 rounded-[14px] font-bold text-[0.8rem] leading-tight transition-colors ${activeTab === 'agenda' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Agenda</button>
          <button onClick={() => setActiveTab('nuevo')} className={`py-3 px-1 rounded-[14px] font-bold text-[0.8rem] leading-tight transition-colors ${activeTab === 'nuevo' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Nuevo</button>
          <button onClick={() => setActiveTab('pacientes')} className={`py-3 px-1 rounded-[14px] font-bold text-[0.8rem] leading-tight transition-colors ${activeTab === 'pacientes' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Pacientes</button>
          {/* NUEVO BOTÓN: Horarios */}
          <button onClick={() => setActiveTab('horarios')} className={`py-3 px-1 rounded-[14px] font-bold text-[0.8rem] leading-tight transition-colors ${activeTab === 'horarios' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Horarios</button>
          <button onClick={() => setActiveTab('ajustes')} className={`py-3 px-1 rounded-[14px] font-bold text-[0.8rem] leading-tight transition-colors ${activeTab === 'ajustes' ? 'bg-violet-700 text-white' : 'text-violet-900 bg-glass_sec_bg border border-line'}`}>Ajustes</button>
        </div>
      </nav>
    </div>
  );
}