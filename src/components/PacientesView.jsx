import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PacientesView({ profesional }) {
  const [pacientes, setPacientes] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  
  // Modales
  const [pacienteEditar, setPacienteEditar] = useState(null);
  const [pacienteDetalle, setPacienteDetalle] = useState(null);
  
  // Datos del detalle
  const [historialTurnos, setHistorialTurnos] = useState([]);
  const [notasClinicas, setNotasClinicas] = useState('');
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: dataPacientes } = await supabase
      .from('pacientes')
      .select('*, obras_sociales(nombre)')
      .order('apellido', { ascending: true });
    if (dataPacientes) setPacientes(dataPacientes);

    const { data: dataObras } = await supabase
      .from('obras_sociales')
      .select('*')
      .eq('activa', true)
      .order('nombre', { ascending: true });
    if (dataObras) setObrasSociales(dataObras);
  };

  // --- LÓGICA DE EDICIÓN DE DATOS ---
  const guardarCambios = async (e) => {
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
      mostrarMensaje('Datos actualizados correctamente.', 'exito');
      setPacienteEditar(null);
      cargarDatos();
    } else {
      mostrarMensaje('Error al actualizar paciente.', 'error');
    }
  };

  // --- LÓGICA DE HISTORIA CLÍNICA (DETALLE) ---
  const abrirDetalle = async (paciente) => {
    setPacienteDetalle(paciente);
    setNotasClinicas(paciente.notas_clinicas || '');
    
    // Buscar historial de turnos de este paciente
    const { data: turnos } = await supabase
      .from('turnos')
      // NUEVO: Agregamos nota_clinica a la consulta
      .select('id, inicio, estado, nota_clinica, profesionales(especialidad, nombre, apellido)')
      .eq('paciente_id', paciente.id)
      .order('inicio', { ascending: false });
      
    if (turnos) setHistorialTurnos(turnos);
  };

  const guardarNotas = async () => {
    setGuardandoNotas(true);
    const { error } = await supabase
      .from('pacientes')
      .update({ notas_clinicas: notasClinicas })
      .eq('id', pacienteDetalle.id);

    if (!error) {
      mostrarMensaje('Notas clínicas guardadas.', 'exito');
      // Actualizamos el estado local para no tener que recargar todo
      setPacientes(pacientes.map(p => p.id === pacienteDetalle.id ? { ...p, notas_clinicas: notasClinicas } : p));
    } else {
      mostrarMensaje('Error al guardar las notas.', 'error');
    }
    setGuardandoNotas(false);
  };

  const pacientesFiltrados = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni.includes(busqueda)
  );

  const getBadgeClass = (estado) => {
    const clases = { confirmado: 'bg-[#EDE3F8] text-[#4A2E70]', atendido: 'bg-[#DDEBCF] text-[#2F5420]', ausente: 'bg-[#FBE7C4] text-[#7A4A00]', cancelado: 'bg-[#E6E1EB] text-[#4F4560]' };
    return clases[estado] || clases.confirmado;
  };

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg animate-fade-in relative pb-8">
      
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Directorio de Pacientes</h2>
      <p className="text-muted mb-4">Buscá, editá o revisá la historia clínica.</p>

      <div className="mb-5">
        <input 
          type="text" 
          placeholder="Buscar por apellido, nombre o DNI..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50 font-semibold"
        />
      </div>

      <ul className="grid gap-[10px]">
        {pacientesFiltrados.length === 0 ? (
          <p className="text-muted py-2 font-bold text-center">No se encontraron pacientes.</p>
        ) : (
          pacientesFiltrados.map((paciente) => (
            <li key={paciente.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-field border-[1.5px] border-line rounded-[18px] p-3 transition-colors hover:border-violet-400 group">
              {/* Zona clickeable para abrir la Historia Clínica */}
              <div 
                className="flex-1 min-w-0 cursor-pointer p-1" 
                onClick={() => abrirDetalle(paciente)}
              >
                <strong className="block font-extrabold text-ink text-[1.1rem] truncate group-hover:text-violet-700 transition-colors">
                  {paciente.apellido}, {paciente.nombre}
                </strong>
                <span className="block text-[0.9rem] text-muted mt-0.5">
                  DNI: {paciente.dni} · Cel: {paciente.telefono_wsp}
                </span>
                <span className="block text-[0.85rem] font-bold text-violet-700 mt-1">
                  {paciente.obras_sociales?.nombre || 'Particular'}
                </span>
              </div>
              
              {/* Botón aislado para Editar Datos */}
              <button 
                onClick={(e) => { e.stopPropagation(); setPacienteEditar({ ...paciente, obra_social_id: paciente.obra_social_id || '' }); }}
                className="shrink-0 px-4 py-2 bg-white border border-line text-violet-900 font-bold rounded-[14px] hover:bg-mist transition-colors shadow-sm"
              >
                Editar
              </button>
            </li>
          ))
        )}
      </ul>

      {/* ================= MODAL: DETALLE / HISTORIA CLÍNICA ================= */}
      {pacienteDetalle && (
        <div className="fixed inset-0 z-[60] bg-violet-900/40 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-line rounded-[24px] shadow-xl w-full max-w-[600px] animate-fade-in flex flex-col h-[90vh] sm:h-[85vh] overflow-hidden">
            
            {/* Header del modal */}
            <div className="p-5 border-b border-line bg-mist/30 flex justify-between items-start">
               <div>
                  <h3 className="font-extrabold text-violet-700 text-[1.4rem] leading-tight">{pacienteDetalle.apellido}, {pacienteDetalle.nombre}</h3>
                  <p className="text-muted font-bold text-[0.9rem]">Historia Clínica y Consultas</p>
               </div>
               <button onClick={() => setPacienteDetalle(null)} className="w-8 h-8 flex items-center justify-center bg-white border border-line rounded-full text-ink font-bold hover:bg-field transition-colors">✕</button>
            </div>

            {/* Cuerpo del modal scrolleable */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Sección Notas */}
              <div>
                 <div className="flex justify-between items-end mb-2">
                    <label className="block font-extrabold text-ink text-[1.1rem]">Notas Clínicas</label>
                    <button 
                       onClick={guardarNotas} 
                       disabled={guardandoNotas}
                       className="px-4 py-1.5 bg-violet-700 text-white font-bold rounded-xl text-[0.85rem] shadow-sm disabled:opacity-50"
                    >
                      {guardandoNotas ? 'Guardando...' : 'Guardar notas'}
                    </button>
                 </div>
                 <textarea 
                    value={notasClinicas} 
                    onChange={e => setNotasClinicas(e.target.value)} 
                    placeholder="Escribí aquí las observaciones médicas, diagnósticos o evolución del paciente..."
                    className="w-full h-32 bg-field border-[1.5px] border-line rounded-[16px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50 resize-none font-medium text-ink leading-relaxed"
                 />
              </div>

              {/* Sección Historial */}
              <div>
                 <h4 className="font-extrabold text-ink text-[1.1rem] mb-3">Historial de Consultas</h4>
                 {historialTurnos.length === 0 ? (
                    <p className="text-muted text-[0.9rem] italic border border-dashed border-line p-4 rounded-xl text-center bg-field">
                       Aún no tiene turnos registrados.
                    </p>
                 ) : (
                    <ul className="grid gap-2.5">
                       {historialTurnos.map(turno => (
                         <li key={turno.id} className="flex flex-col gap-2 p-3 bg-white border border-line rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between">
                               <div>
                                  <strong className="block font-bold text-ink text-[0.95rem] capitalize">
                                     {format(parseISO(turno.inicio), "EEEE d MMM yyyy - HH:mm'h'", { locale: es })}
                                  </strong>
                                  <span className="text-muted text-[0.85rem]">
                                     {turno.profesionales?.especialidad?.replace('_', ' ')} (Dra. {turno.profesionales?.apellido})
                                  </span>
                               </div>
                               <span className={`shrink-0 text-[0.75rem] font-extrabold px-[10px] py-[4px] rounded-full uppercase tracking-wider ${getBadgeClass(turno.estado)}`}>
                                  {turno.estado}
                               </span>
                            </div>
                            {/* NUEVO: Mostramos la nota clínica si existe */}
                            {turno.nota_clinica && (
                              <div className="bg-[#F3ECF9] border border-violet-200 rounded-xl p-2.5 mt-1">
                                <p className="text-[0.9rem] text-violet-900 font-medium leading-tight">
                                  <span className="font-bold mr-1">Nota Clínica:</span> {turno.nota_clinica}
                                </p>
                              </div>
                            )}
                         </li>
                       ))}
                    </ul>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDICIÓN DE DATOS ================= */}
      {/* (Se mantiene exactamente igual que antes para no romper la edición) */}
      {pacienteEditar && (
        <div className="fixed inset-0 z-[70] bg-violet-900/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[24px] p-6 shadow-xl w-full max-w-[380px] animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-violet-700 text-[1.4rem] mb-4">Editar Paciente</h3>
            
            <form onSubmit={guardarCambios} className="grid gap-4">
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
    </div>
  );
}