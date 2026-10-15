import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const DIAS_SEMANA = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' },
  { id: 6, nombre: 'Sábado' },
  { id: 7, nombre: 'Domingo' }
];

export default function HorariosView({ profesional }) {
  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map(d => ({ 
      ...d, 
      activo: false, 
      desde: '08:30', 
      hasta: '12:30',
      tardeActiva: false,
      desdeTarde: '16:00',
      hastaTarde: '20:00'
    }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    fetchHorarios();
  }, []);

  const fetchHorarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('horarios_atencion')
      .select('*')
      .eq('profesional_id', profesional.profesionales.id);

    if (data) {
      const horariosCargados = DIAS_SEMANA.map(diaBase => {
        const guardado = data.find(d => d.dia_semana === diaBase.id);
        if (guardado) {
          return { 
            ...diaBase, 
            activo: true, 
            desde: guardado.hora_desde?.slice(0, 5) || '08:30', 
            hasta: guardado.hora_hasta?.slice(0, 5) || '12:30',
            tardeActiva: !!guardado.hora_desde_tarde,
            desdeTarde: guardado.hora_desde_tarde?.slice(0, 5) || '16:00',
            hastaTarde: guardado.hora_hasta_tarde?.slice(0, 5) || '20:00'
          };
        }
        return { ...diaBase, activo: false, desde: '08:30', hasta: '12:30', tardeActiva: false, desdeTarde: '16:00', hastaTarde: '20:00' };
      });
      setHorarios(horariosCargados);
    }
    setLoading(false);
  };

  const handleCambio = (id, campo, valor) => {
    setHorarios(prev => prev.map(h => h.id === id ? { ...h, [campo]: valor } : h));
  };

  const guardarHorarios = async () => {
    setSaving(true);
    setMensaje(null);
    
    await supabase.from('horarios_atencion').delete().eq('profesional_id', profesional.profesionales.id);

    const horariosAInsertar = horarios
      .filter(h => h.activo)
      .map(h => ({
        profesional_id: profesional.profesionales.id,
        dia_semana: h.id,
        hora_desde: h.desde,
        hora_hasta: h.hasta,
        hora_desde_tarde: h.tardeActiva ? h.desdeTarde : null,
        hora_hasta_tarde: h.tardeActiva ? h.hastaTarde : null
      }));

    if (horariosAInsertar.length > 0) {
      const { error } = await supabase.from('horarios_atencion').insert(horariosAInsertar);
      if (error) {
        setMensaje({ tipo: 'error', texto: 'Error al guardar. Intentá de nuevo.' });
        setSaving(false);
        return;
      }
    }
    
    setMensaje({ tipo: 'exito', texto: '¡Tus horarios se actualizaron correctamente!' });
    setSaving(false);
    setTimeout(() => setMensaje(null), 3000);
  };

  if (loading) return <div className="p-6 font-bold text-violet-700">Cargando configuración...</div>;

  return (
    <div className="card bg-surface backdrop-blur-md border border-line rounded-[24px] p-[22px] shadow-[0_10px_30px_rgba(62,39,96,0.12)] animate-fade-in pb-8">
      <h2 className="text-[1.55rem] font-extrabold text-violet-700 tracking-tight mb-1">Mis horarios</h2>
      <p className="text-muted mb-5 text-[0.95rem]">
        Elegí qué días atendés y tus franjas horarias.
      </p>

      <div className="grid gap-3 mb-6">
        {horarios.map((dia) => (
          <div key={dia.id} className={`flex flex-col gap-3 p-4 border-[1.5px] rounded-[18px] transition-colors ${dia.activo ? 'border-violet-500 bg-field shadow-sm' : 'border-line bg-surface/50'}`}>
            
            {/* Header del Día */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={dia.activo} 
                  onChange={(e) => handleCambio(dia.id, 'activo', e.target.checked)}
                  className="w-5 h-5 accent-violet-700 cursor-pointer"
                />
                <span className={`font-extrabold text-[1.1rem] ${dia.activo ? 'text-violet-900' : 'text-muted'}`}>
                  {dia.nombre}
                </span>
              </label>

              {dia.activo && !dia.tardeActiva && (
                <button onClick={() => handleCambio(dia.id, 'tardeActiva', true)} className="text-[0.85rem] font-bold text-violet-700 bg-violet-100 px-3 py-1 rounded-full hover:bg-violet-200 transition-colors">
                  + Turno tarde
                </button>
              )}
            </div>

            {/* Bloque de Horarios (Solo si está activo) */}
            {dia.activo && (
              <div className="animate-fade-in grid gap-2 mt-1">
                
                {/* Mañana */}
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[0.85rem] font-bold text-muted">Mañana</span>
                  <input type="time" value={dia.desde} onChange={(e) => handleCambio(dia.id, 'desde', e.target.value)} className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:ring-2 focus:ring-violet-500/50" />
                  <span className="text-muted font-bold text-[0.9rem]">a</span>
                  <input type="time" value={dia.hasta} onChange={(e) => handleCambio(dia.id, 'hasta', e.target.value)} className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:ring-2 focus:ring-violet-500/50" />
                </div>

                {/* Tarde */}
                {dia.tardeActiva && (
                  <div className="flex items-center gap-2 mt-1 animate-fade-in">
                    <span className="w-14 text-[0.85rem] font-bold text-muted">Tarde</span>
                    <input type="time" value={dia.desdeTarde} onChange={(e) => handleCambio(dia.id, 'desdeTarde', e.target.value)} className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:ring-2 focus:ring-violet-500/50" />
                    <span className="text-muted font-bold text-[0.9rem]">a</span>
                    <input type="time" value={dia.hastaTarde} onChange={(e) => handleCambio(dia.id, 'hastaTarde', e.target.value)} className="flex-1 bg-white border border-line rounded-xl p-2 text-center font-bold focus:ring-2 focus:ring-violet-500/50" />
                    <button onClick={() => handleCambio(dia.id, 'tardeActiva', false)} className="ml-1 p-2 text-[#B3261E] hover:bg-[#B3261E]/10 rounded-full transition-colors" title="Quitar turno tarde">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                )}
                
              </div>
            )}
          </div>
        ))}
      </div>

      {mensaje && (
        <div className={`p-3 mb-4 rounded-[14px] font-bold text-center ${mensaje.tipo === 'exito' ? 'bg-leaf/20 text-leaf-700' : 'bg-err/20 text-err'}`}>
          {mensaje.texto}
        </div>
      )}

      <button 
        onClick={guardarHorarios}
        disabled={saving}
        className="w-full text-white font-extrabold text-[1.05rem] py-3.5 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-700 shadow-[0_8px_20px_rgba(62,39,96,0.25)] hover:-translate-y-0.5 transition-transform disabled:opacity-70 disabled:transform-none"
      >
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  );
}