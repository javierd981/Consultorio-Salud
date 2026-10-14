import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function PacientesView() {
  const [pacientes, setPacientes] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [pacienteEditar, setPacienteEditar] = useState(null);
  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    // Cargamos pacientes
    const { data: dataPacientes } = await supabase
      .from('pacientes')
      .select('*, obras_sociales(nombre)')
      .order('apellido', { ascending: true });
    if (dataPacientes) setPacientes(dataPacientes);

    // Cargamos obras sociales para el select del modal de edición
    const { data: dataObras } = await supabase
      .from('obras_sociales')
      .select('*')
      .eq('activa', true)
      .order('nombre', { ascending: true });
    if (dataObras) setObrasSociales(dataObras);
  };

  const guardarCambios = async (e) => {
    e.preventDefault();
    
    // Formateamos el ID de la obra social (si es particular o vacío, va null)
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
      cargarDatos(); // Recargamos para reflejar cambios
    } else {
      mostrarMensaje('Error al actualizar paciente.', 'error');
    }
  };

  // Filtro de búsqueda por nombre, apellido o DNI
  const pacientesFiltrados = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni.includes(busqueda)
  );

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg animate-fade-in relative pb-8">
      
      {/* Toast Notification */}
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Directorio de Pacientes</h2>
      <p className="text-muted mb-4">Buscá y editá los datos de contacto o cobertura.</p>

      {/* Buscador */}
      <div className="mb-5">
        <input 
          type="text" 
          placeholder="Buscar por apellido, nombre o DNI..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50 font-semibold"
        />
      </div>

      {/* Lista de pacientes */}
      <ul className="grid gap-[10px]">
        {pacientesFiltrados.length === 0 ? (
          <p className="text-muted py-2 font-bold text-center">No se encontraron pacientes.</p>
        ) : (
          pacientesFiltrados.map((paciente) => (
            <li key={paciente.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-field border-[1.5px] border-line rounded-[18px] p-4 transition-colors hover:border-violet-300">
              <div className="flex-1 min-w-0">
                <strong className="block font-extrabold text-ink text-[1.1rem] truncate">
                  {paciente.apellido}, {paciente.nombre}
                </strong>
                <span className="block text-[0.9rem] text-muted mt-0.5">
                  DNI: {paciente.dni} · WhatsApp: {paciente.telefono_wsp}
                </span>
                <span className="block text-[0.85rem] font-bold text-violet-700 mt-1">
                  {paciente.obras_sociales?.nombre || 'Particular'} {paciente.nro_afiliado ? `- Afiliado: ${paciente.nro_afiliado}` : ''}
                </span>
              </div>
              <button 
                onClick={() => setPacienteEditar({ ...paciente, obra_social_id: paciente.obra_social_id || '' })}
                className="shrink-0 px-4 py-2 bg-glass_sec_bg border border-line text-violet-900 font-bold rounded-[14px] hover:bg-violet-100 transition-colors"
              >
                Editar
              </button>
            </li>
          ))
        )}
      </ul>

      {/* MODAL DE EDICIÓN */}
      {pacienteEditar && (
        <div className="fixed inset-0 z-[60] bg-violet-900/40 flex items-center justify-center p-4">
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
                <button type="button" onClick={() => setPacienteEditar(null)} className="flex-1 py-3 rounded-xl font-bold bg-glass_sec_bg text-violet-900 border border-line">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-violet-700 text-white shadow-md">Guardar</button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}