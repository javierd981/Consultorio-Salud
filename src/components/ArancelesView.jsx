import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ArancelesView({ profesional }) {
  const [aranceles, setAranceles] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [montos, setMontos] = useState({});
  const [guardando, setGuardando] = useState(false);
  
  // Estado para el cartelito flotante
  const [toast, setToast] = useState({ visible: false, text: '', tipo: '' });

  const mostrarMensaje = (text, tipo = 'exito') => {
    setToast({ visible: true, text, tipo });
    setTimeout(() => setToast({ visible: false, text: '', tipo: '' }), 4000);
  };

  useEffect(() => {
    if (profesional) cargarDatos();
  }, [profesional]);

  const cargarDatos = async () => {
    const [resObras, resAranceles] = await Promise.all([
      supabase.from('obras_sociales').select('*').eq('activa', true),
      supabase.from('aranceles').select('*').eq('profesional_id', profesional.profesionales.id)
    ]);
    
    if (resObras.data) setObrasSociales(resObras.data);
    
    if (resAranceles.data) {
      setAranceles(resAranceles.data);
      const map = {};
      resAranceles.data.forEach(a => map[a.obra_social_id] = a.monto);
      setMontos(map);
    }
  };

  // NUEVA FUNCIÓN: Guarda todos los aranceles modificados de una sola vez
  const guardarTodos = async () => {
    setGuardando(true);
    
    // Preparamos el array con todos los datos a insertar/actualizar
    const updates = obrasSociales.map(os => ({
      profesional_id: profesional.profesionales.id,
      obra_social_id: os.id,
      monto: parseFloat(montos[os.id]) || 0
    }));

    const { error } = await supabase.from('aranceles').upsert(
      updates, 
      { onConflict: 'profesional_id,obra_social_id' }
    );

    setGuardando(false);

    if (!error) {
      mostrarMensaje('¡Todos los aranceles fueron actualizados!', 'exito');
    } else {
      mostrarMensaje('Error al guardar los aranceles.', 'error');
    }
  };

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg animate-fade-in relative pb-6">
      
      {/* Cartelito flotante (Toast) */}
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Mis Aranceles</h2>
      <p className="text-muted mb-4">Definí el valor de consulta para cada obra social.</p>
      
      <div className="grid gap-3 mb-6">
        {obrasSociales.map(os => (
          <div key={os.id} className="flex items-center justify-between gap-3 bg-field border border-line rounded-[16px] p-3 transition-colors hover:border-violet-300">
            <span className="font-extrabold text-ink truncate">{os.nombre}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted font-bold">$</span>
              <input 
                type="number" 
                value={montos[os.id] || ''} 
                onChange={e => setMontos({...montos, [os.id]: e.target.value})} 
                placeholder="0.00" 
                className="w-24 sm:w-28 bg-white border border-line rounded-xl p-2 font-bold text-ink focus:outline-none focus:ring-2 focus:ring-violet-500 text-right"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Botón único de guardado */}
      <button 
        onClick={guardarTodos} 
        disabled={guardando}
        className="w-full py-3.5 bg-violet-700 text-white font-extrabold text-[1.05rem] rounded-2xl shadow-[0_8px_20px_rgba(62,39,96,0.25)] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}
      </button>

    </div>
  );
}