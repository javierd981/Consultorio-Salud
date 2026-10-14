import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PacientesView({ profesional }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Estado para la Ficha Clínica
  const [pacienteActivo, setPacienteActivo] = useState(null);
  const [historialTurnos, setHistorialTurnos] = useState([]);
  const [notas, setNotas] = useState([]);
  const [nuevaNota, setNuevaNota] = useState('');

  useEffect(() => {
    fetchPacientes();
  }, []);

  const fetchPacientes = async () => {
    setLoading(true);
    // RLS filtra automáticamente para que la doctora solo vea a sus pacientes
    const { data, error } = await supabase
      .from('pacientes')
      .select('*, obras_sociales(nombre)')
      .order('nombre', { ascending: true });
    
    if (data) setPacientes(data);
    setLoading(false);
  };

  // Cargar datos al abrir la ficha de un paciente
  const abrirFicha = async (paciente) => {
    setPacienteActivo(paciente);
    
    // 1. Cargar historial de turnos del paciente con esta profesional
    const resTurnos = await supabase
      .from('turnos')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('inicio', { ascending: false });
    if (resTurnos.data) setHistorialTurnos(resTurnos.data);

    // 2. Cargar notas clínicas (Privadas)
    const resNotas = await supabase
      .from('notas_clinicas')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('created_at', { ascending: false });
    if (resNotas.data) setNotas(resNotas.data);
  };

  const guardarNota = async () => {
    if (!nuevaNota.trim()) return;
    const { data, error } = await supabase
      .from('notas_clinicas')
      .insert([{
        paciente_id: pacienteActivo.id,
        profesional_id: profesional.profesionales.id, // ID real de la doctora
        contenido: nuevaNota
      }])
      .select()
      .single();

    if (data) {
      setNotas([data, ...notas]);
      setNuevaNota('');
    }
  };

  // Filtrado de búsqueda
  const pacientesFiltrados = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.apellido.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.dni.includes(busqueda.replace(/\D/g, ''))
  );

  const getBadgeClass = (estado) => {
    const clases = { confirmado: 'bg-[#EDE3F8] text-[#4A2E70]', atendido: 'bg-[#DDEBCF] text-[#2F5420]', ausente: 'bg-[#FBE7C4] text-[#7A4A00]', cancelado: 'bg-[#E6E1EB] text-[#4F4560]' };
    return clases[estado] || clases.confirmado;
  };

  // Freno de seguridad mientras carga el perfil
  if (!profesional || !profesional.profesionales) return null;

  // --- VISTA: FICHA CLÍNICA ---
  if (pacienteActivo) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setPacienteActivo(null)} className="font-bold text-[0.98rem] text-violet-900 bg-glass_sec_bg border border-line px-4 py-2 rounded-[14px] shadow-sm mb-3 hover:-translate-y-0.5 transition-transform">
          Volver a pacientes
        </button>
        
        {/* Cabecera Ficha */}
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg mb-3.5">
          <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight">{pacienteActivo.nombre} {pacienteActivo.apellido}</h2>
          <p className="text-muted text-[0.95rem] mb-3">Paciente de {profesional.profesionales.especialidad.replace('_', ' ')}</p>
          <div className="grid divide-y-[1px] divide-line text-[0.95rem]">
            <div className="flex justify-between py-2.5"><dt className="font-bold text-muted">DNI</dt><dd className="font-bold">{pacienteActivo.dni}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="font-bold text-muted">WhatsApp</dt><dd className="font-bold">{pacienteActivo.telefono_wsp}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="font-bold text-muted">Obra social</dt><dd className="font-bold">{pacienteActivo.obras_sociales?.nombre || 'Particular'}</dd></div>
            {pacienteActivo.nro_afiliado && <div className="flex justify-between py-2.5"><dt className="font-bold text-muted">N.º de afiliado</dt><dd className="font-bold">{pacienteActivo.nro_afiliado}</dd></div>}
          </div>
        </div>

        {/* Historial de Turnos */}
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg mb-3.5">
          <h3 className="text-[1.1rem] font-extrabold">Turnos</h3>
          <p className="text-muted text-[0.95rem] mb-3">Próximos y anteriores con vos.</p>
          <ul className="grid gap-2">
            {historialTurnos.length === 0 ? <li className="text-muted">No hay turnos registrados.</li> : historialTurnos.map(t => (
              <li key={t.id} className="flex justify-between items-center py-2 border-b-[1px] border-line last:border-0">
                <span>
                  <strong className="capitalize">{format(parseISO(t.inicio), "d 'de' MMM", {locale: es})}</strong> · {format(parseISO(t.inicio), "HH:mm")} h
                </span>
                <span className={`text-[0.85rem] font-extrabold px-[10px] py-[4px] rounded-full ${getBadgeClass(t.estado)}`}>{t.estado}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Notas Privadas */}
        <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg">
          <h3 className="text-[1.1rem] font-extrabold">Notas privadas</h3>
          <p className="text-muted text-[0.95rem] mb-3">Solo las ves vos. Ni la secretaría puede leerlas.</p>
          
          <div className="grid gap-2.5 mb-3.5 max-h-[300px] overflow-y-auto">
            {notas.length === 0 ? <p className="text-muted">Todavía no hay notas. Escribí la primera abajo.</p> : notas.map(n => (
              <div key={n.id} className="bg-field border-[1.5px] border-line rounded-[14px] p-3">
                <time className="block text-muted text-[0.88rem] font-bold mb-0.5 capitalize">{format(parseISO(n.created_at), "d 'de' MMM, yyyy", {locale: es})}</time>
                <p className="whitespace-pre-wrap">{n.contenido}</p>
              </div>
            ))}
          </div>

          <label className="block font-bold mb-1.5">Nueva nota</label>
          <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} className="w-full bg-field border-[1.5px] border-line rounded-[14px] p-3 min-h-[96px] focus:outline-none focus:ring-4 focus:ring-violet-500/50 resize-y" />
          <button onClick={guardarNota} className="w-full mt-3 text-white font-extrabold text-[1.05rem] py-3 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-700 shadow-md hover:-translate-y-0.5 transition-transform">
            Guardar nota
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA: LISTA DE PACIENTES ---
  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-[0_10px_30px_rgba(62,39,96,0.12)]">
      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Pacientes</h2>
      <p className="text-muted mb-3.5">Solo ves los pacientes de {profesional.profesionales.especialidad.replace('_', ' ')}.</p>
      
      <div className="mb-3.5">
        <label className="block font-bold mb-1.5">Buscar por nombre o DNI</label>
        <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full bg-field border-[1.5px] border-line rounded-[14px] p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
      </div>
      <div className="text-muted font-semibold mb-2.5">{pacientesFiltrados.length} pacientes</div>
      
      <ul className="grid gap-2.5">
        {loading ? <p className="text-muted font-bold py-2">Cargando pacientes...</p> : pacientesFiltrados.length === 0 ? <p className="text-muted py-2">No hay pacientes con ese nombre o DNI.</p> : pacientesFiltrados.map(p => (
          <li key={p.id}>
            <button onClick={() => abrirFicha(p)} className="w-full flex items-center gap-3.5 bg-field border-[1.5px] border-line rounded-[18px] p-3 min-h-[68px] hover:border-violet-500 transition-colors text-left">
              <span className="flex-1 min-w-0">
                <strong className="block font-extrabold leading-[1.25] text-ink truncate">{p.nombre} {p.apellido}</strong>
                <small className="block text-[0.9rem] text-muted truncate">{p.obras_sociales?.nombre || 'Particular'} · DNI {p.dni}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}