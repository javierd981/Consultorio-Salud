import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ArancelesView({ profesional }) {
  const [aranceles, setAranceles] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [montos, setMontos] = useState({});
  
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

  const guardarMonto = async (obraSocialId) => {
    const monto = parseFloat(montos[obraSocialId]) || 0;
    const { error } = await supabase.from('aranceles').upsert([
      { profesional_id: profesional.profesionales.id, obra_social_id: obraSocialId, monto }
    ], { onConflict: 'profesional_id,obra_social_id' });

    if (!error) {
      mostrarMensaje('¡Arancel guardado con éxito!', 'exito');
    } else {
      mostrarMensaje('Error al guardar el arancel.', 'error');
    }
  };

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-lg animate-fade-in relative">
      
      {/* Cartelito flotante (Toast) */}
      {toast.visible && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] ${toast.tipo === 'error' ? 'bg-[#B3261E]' : 'bg-[#4C7536]'} text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-center animate-fade-in max-w-[90%] w-max`}>
          {toast.text}
        </div>
      )}

      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Mis Aranceles</h2>
      <p className="text-muted mb-4">Definí el valor de consulta para cada obra social.</p>
      
      <div className="grid gap-3">
        {obrasSociales.map(os => (
          <div key={os.id} className="flex items-center justify-between gap-3 bg-field border border-line rounded-[16px] p-3">
            <span className="font-extrabold text-ink">{os.nombre}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted font-bold">$</span>
              <input 
                type="number" 
                value={montos[os.id] || ''} 
                onChange={e => setMontos({...montos, [os.id]: e.target.value})} 
                placeholder="0.00" 
                className="w-28 bg-white border border-line rounded-xl p-2 font-bold text-ink focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button onClick={() => guardarMonto(os.id)} className="px-4 py-2 bg-violet-700 text-white font-extrabold rounded-xl shadow-sm hover:-translate-y-0.5 transition-transform">Guardar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}