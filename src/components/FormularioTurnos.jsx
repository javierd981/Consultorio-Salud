import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function FormularioTurnos() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [profesionales, setProfesionales] = useState([]);

  // Estado del formulario
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', tel: '', consent: false,
    obraSocialId: '', afiliado: '',
    especialidad: '', profId: '',
    dia: null, slotSeleccionado: null // slot guardará { inicio, fin }
  });

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState('');

  // Días a mostrar en el paso 4
  const dias = Array.from({ length: 7 })
    .map((_, i) => addDays(startOfToday(), i + 1))
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6) // Solo Lunes a Viernes
    .slice(0, 5); // Tomamos 5 días hábiles

  useEffect(() => {
    cargarDatosBase();
  }, []);

  const cargarDatosBase = async () => {
    const [resObras, resProf] = await Promise.all([
      supabase.from('obras_sociales').select('*').eq('activa', true),
      supabase.from('profesionales').select('*').eq('activo', true)
    ]);
    if (resObras.data) setObrasSociales(resObras.data);
    if (resProf.data) setProfesionales(resProf.data);
    setLoading(false);
  };

  // Buscar horarios usando tu función SQL "horarios_libres"
  useEffect(() => {
    if (step === 4 && form.profId && form.dia) {
      buscarHorarios();
    }
  }, [step, form.dia, form.profId]);

  const buscarHorarios = async () => {
    setBuscandoHorarios(true);
    setForm({ ...form, slotSeleccionado: null }); // Limpiar selección anterior
    const { data, error } = await supabase.rpc('horarios_libres', {
      p_profesional: form.profId,
      p_fecha: format(form.dia, 'yyyy-MM-dd')
    });
    if (data) setHorariosDisponibles(data);
    setBuscandoHorarios(false);
  };

  const handleNext = () => {
    setErrorValidacion('');
    if (step === 1) {
      if (form.nombre.length < 2 || form.apellido.length < 2) return setErrorValidacion('Escribí tu nombre y apellido.');
      if (!/^\d{7,8}$/.test(form.dni.replace(/\D/g, ''))) return setErrorValidacion('El DNI debe tener 7 u 8 números.');
      if (form.tel.replace(/\D/g, '').length < 10) return setErrorValidacion('Revisá tu número de WhatsApp.');
      if (!form.consent) return setErrorValidacion('Necesitamos tu aceptación para continuar.');
    }
    if (step === 2) {
      if (!form.obraSocialId) return setErrorValidacion('Elegí tu obra social o Particular.');
      const os = obrasSociales.find(o => o.id.toString() === form.obraSocialId);
      if (os?.nombre !== 'Particular' && form.afiliado.length < 3) return setErrorValidacion('Escribí tu número de afiliado.');
    }
    if (step === 3 && !form.profId) return setErrorValidacion('Elegí una especialidad.');
    if (step === 4 && !form.slotSeleccionado) return setErrorValidacion('Elegí un día y un horario libre.');

    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Registrar el paciente (si es nuevo) y el turno
  const confirmarTurno = async () => {
    setErrorValidacion('Procesando turno...');
    
    // 1. Verificar si el paciente ya existe por su DNI
    let { data: pacienteExistente } = await supabase
      .from('pacientes').select('id').eq('dni', form.dni).maybeSingle();
    
    let pacienteId = pacienteExistente?.id;

    // 2. Si no existe, lo creamos
    if (!pacienteId) {
      const osIdInt = parseInt(form.obraSocialId, 10);
      const { data: nuevoPac, error: errPac } = await supabase
        .from('pacientes').insert([{
          dni: form.dni.replace(/\D/g, ''),
          nombre: form.nombre,
          apellido: form.apellido,
          telefono_wsp: form.tel,
          obra_social_id: osIdInt || null,
          nro_afiliado: form.afiliado,
          consentimiento_datos_at: new Date().toISOString()
        }]).select().single();
      
      if (errPac) return setErrorValidacion('Error al guardar datos del paciente.');
      pacienteId = nuevoPac.id;
    }

    // 3. Insertar el Turno (El trigger de la BD lo vinculará automáticamente)
    const { error: errTurno } = await supabase
      .from('turnos').insert([{
        profesional_id: form.profId,
        paciente_id: pacienteId,
        inicio: form.slotSeleccionado.inicio,
        fin: form.slotSeleccionado.fin,
        origen: 'web',
        estado: 'confirmado'
      }]);

    if (errTurno) return setErrorValidacion('El horario acaba de ser ocupado. Elegí otro.');
    
    setErrorValidacion(''); // <-- Limpiamos el texto de carga aquí
    setStep(6); // Ir a pantalla de éxito
  };

  if (loading) return <div className="p-10 text-center text-violet-700 font-bold">Cargando...</div>;

  return (
    <div className="relative z-10 max-w-[640px] mx-auto p-4 pt-5 min-h-screen flex flex-col">
      <BackgroundBlobs />
      
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3.5 mb-4 bg-surface backdrop-blur-md border border-line rounded-[22px] p-3 shadow-sm">
        <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-white border-2 border-white/80 shadow-md">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="font-extrabold text-violet-700 text-[1.15rem] leading-tight">Consultorios de Salud</div>
          <div className="text-muted text-[0.95rem]">Pedí tu turno en pocos pasos</div>
        </div>
      </header>

      {/* Barra de progreso */}
      {step < 6 && (
        <div className="relative z-10 mb-4">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${step > i ? 'bg-violet-500' : step === i ? 'bg-leaf' : 'bg-line'}`}></span>
            ))}
          </div>
          <div className="mt-2 text-[0.95rem] text-muted font-semibold">Paso {step} de 5</div>
        </div>
      )}

      {/* Tarjeta Principal */}
      <main className="relative z-10 flex-1 card bg-surface backdrop-blur-md border border-line rounded-[24px] p-6 shadow-lg mb-6">
        
        {/* PASO 1: Datos */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-1">Tus datos</h2>
            <p className="text-muted mb-5">Los usamos para registrar tu turno y avisarte por WhatsApp.</p>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1.5">Nombre</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">Apellido</label>
                  <input type="text" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1.5">DNI</label>
                <input type="tel" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} placeholder="Sin puntos" className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
              </div>
              <div>
                <label className="block font-bold mb-1.5">WhatsApp</label>
                <input type="tel" value={form.tel} onChange={e => setForm({...form, tel: e.target.value})} placeholder="Ej: 3815551234" className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
              </div>
              <label className="flex gap-3 items-start p-3.5 bg-field border-[1.5px] border-line rounded-2xl cursor-pointer">
                <input type="checkbox" checked={form.consent} onChange={e => setForm({...form, consent: e.target.checked})} className="w-6 h-6 mt-0.5 accent-violet-700 shrink-0" />
                <span>Acepto que el consultorio use mis datos personales para gestionar mis turnos.</span>
              </label>
            </div>
          </div>
        )}

        {/* PASO 2: Cobertura */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-1">Tu cobertura</h2>
            <p className="text-muted mb-5">Así sabemos qué obra social cargar en tu turno.</p>
            <div className="grid gap-4">
              <div>
                <label className="block font-bold mb-1.5">Obra Social</label>
                <select value={form.obraSocialId} onChange={e => setForm({...form, obraSocialId: e.target.value, afiliado: ''})} className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50">
                  <option value="">Elegí una opción</option>
                  {obrasSociales.map(os => <option key={os.id} value={os.id}>{os.nombre}</option>)}
                </select>
              </div>
              {obrasSociales.find(o => o.id.toString() === form.obraSocialId)?.nombre !== 'Particular' && form.obraSocialId && (
                <div>
                  <label className="block font-bold mb-1.5">Número de afiliado</label>
                  <input type="text" value={form.afiliado} onChange={e => setForm({...form, afiliado: e.target.value})} className="w-full bg-field border-[1.5px] border-line rounded-2xl p-3 focus:outline-none focus:ring-4 focus:ring-violet-500/50" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 3: Especialidad */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-1">Especialidad</h2>
            <p className="text-muted mb-5">¿Con quién querés atenderte?</p>
            <div className="grid gap-3">
              {profesionales.map(prof => (
                <label key={prof.id} className={`relative block cursor-pointer border-2 rounded-[18px] p-4 pr-12 transition-colors ${form.profId === prof.id ? 'border-violet-500 bg-mist' : 'bg-field border-line'}`}>
                  <input type="radio" name="profId" className="absolute opacity-0 inset-0 cursor-pointer" onChange={() => setForm({...form, profId: prof.id, especialidad: prof.especialidad, dia: null})} />
                  <span className="block font-extrabold text-[1.1rem] capitalize">{prof.especialidad.replace('_', ' ')}</span>
                  <span className="block text-muted text-[0.95rem]">Dra. {prof.nombre} {prof.apellido}</span>
                  {form.profId === prof.id && (
                    <span className="absolute right-[18px] top-1/2 -mt-3 w-6 h-6 rounded-full border-2 border-leaf-700 bg-leaf-700 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* PASO 4: Días y Horarios */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-1">Elegí día y horario</h2>
            <p className="text-muted mb-5">Estos son los turnos libres de la doctora.</p>
            
            <div className="font-bold mb-1.5">Día</div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {dias.map((d, i) => {
                const isSelected = form.dia?.getTime() === d.getTime();
                return (
                  <button key={i} onClick={() => setForm({...form, dia: d})} className={`shrink-0 min-w-[72px] py-2 px-3 rounded-2xl border-2 transition-colors ${isSelected ? 'bg-violet-700 border-violet-500 text-white' : 'bg-field border-line text-ink'}`}>
                    <span className={`block text-[0.85rem] ${isSelected ? 'text-[#E7DAF5]' : 'text-muted'}`}>{format(d, 'EEE', {locale: es})}</span>
                    <span className="block text-[1.35rem] font-extrabold leading-[1.2]">{format(d, 'd')}</span>
                  </button>
                )
              })}
            </div>

            {form.dia && (
              <div className="mt-4">
                <div className="font-bold mb-2">Horarios Libres</div>
                {buscandoHorarios ? (
                  <div className="text-muted font-bold py-2">Buscando disponibilidad...</div>
                ) : horariosDisponibles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2.5">
                    {horariosDisponibles.map((slot, i) => {
                      const isSelected = form.slotSeleccionado?.inicio === slot.inicio;
                      return (
                        <button key={i} onClick={() => setForm({...form, slotSeleccionado: slot})} className={`py-3 px-2 rounded-[14px] font-bold border-2 transition-colors ${isSelected ? 'bg-violet-700 border-violet-500 text-white' : 'bg-field border-line text-ink'}`}>
                          {format(parseISO(slot.inicio), 'HH:mm')}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-muted py-2">No quedan turnos para este día. Elegí otro.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PASO 5: Confirmación */}
        {step === 5 && (
          <div className="animate-fade-in">
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight mb-1">Revisá y confirmá</h2>
            <p className="text-muted mb-4">Si algo no está bien, tocá "Cambiar".</p>
            <div className="grid divide-y-[1px] divide-line">
              <Row title="Paciente" val={`${form.nombre} ${form.apellido}`} sub={`DNI ${form.dni} · Cel: ${form.tel}`} onEdit={() => setStep(1)} />
              <Row title="Cobertura" val={obrasSociales.find(o => o.id.toString() === form.obraSocialId)?.nombre} sub={form.afiliado ? `Afiliado: ${form.afiliado}` : null} onEdit={() => setStep(2)} />
              <Row title="Especialidad" val={profesionales.find(p => p.id === form.profId)?.especialidad.replace('_', ' ')} onEdit={() => setStep(3)} />
              <Row title="Turno" val={`${format(form.dia, 'EEEE d', {locale: es})} a las ${format(parseISO(form.slotSeleccionado.inicio), 'HH:mm')} h`} onEdit={() => setStep(4)} />
            </div>
          </div>
        )}

        {/* PASO 6: Éxito */}
        {step === 6 && (
          <div className="text-center py-4 animate-fade-in">
            <div className="w-[84px] h-[84px] mx-auto mb-4 bg-leaf-700 rounded-full flex items-center justify-center shadow-[0_10px_24px_rgba(76,117,54,0.4)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            </div>
            <h2 className="text-[1.6rem] font-extrabold text-violet-700 leading-tight">Turno confirmado</h2>
            <p className="text-muted mt-2">El consultorio te va a enviar un mensaje por WhatsApp muy pronto.</p>
            <div className="mt-5 p-4 rounded-[16px] text-left bg-field border-[1.5px] border-line">
              <strong className="block text-[1.15rem] capitalize">{form.especialidad.replace('_', ' ')}</strong>
              {format(form.dia, 'EEEE d', {locale: es})} a las {format(parseISO(form.slotSeleccionado?.inicio), 'HH:mm')} h<br/>
              <span className="text-muted">Paciente: {form.nombre} {form.apellido}</span>
            </div>
            <button onClick={() => window.location.reload()} className="mt-6 text-violet-700 font-bold underline">Volver al inicio</button>
          </div>
        )}

        {/* Errores de validación - Se oculta si ya pasamos al paso 6 */}
        {errorValidacion && step < 6 && <p className="text-err font-bold mt-4 animate-pulse">{errorValidacion}</p>}

      </main>

      {/* Botonera Flotante (Pasos 1 al 5) */}
      {step < 6 && (
        <div className="relative z-10 sticky bottom-0 flex gap-3 py-4 mt-auto">
          {step > 1 && (
            <button onClick={() => {setStep(step - 1); setErrorValidacion('');}} className="px-6 font-extrabold rounded-[18px] bg-glass_sec_bg text-violet-900 border border-line backdrop-blur-md shadow-sm">
              Atrás
            </button>
          )}
          {step < 5 ? (
            <button onClick={handleNext} className="flex-1 py-3 font-extrabold rounded-[18px] text-white bg-gradient-to-b from-violet-500 to-violet-700 shadow-[0_10px_24px_rgba(62,39,96,0.28)] hover:-translate-y-0.5 transition-transform">
              Continuar
            </button>
          ) : (
            <button onClick={confirmarTurno} className="flex-1 py-3 font-extrabold rounded-[18px] text-white bg-gradient-to-b from-leaf to-leaf-700 shadow-[0_10px_24px_rgba(20,40,10,0.4)] hover:-translate-y-0.5 transition-transform">
              Confirmar turno
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Componente para filas de Resumen
function Row({ title, val, sub, onEdit }) {
  return (
    <div className="flex justify-between items-start gap-3 py-3.5">
      <div>
        <div className="font-bold text-muted text-[0.92rem]">{title}</div>
        <div className="font-bold mt-0.5 capitalize">{val}</div>
        {sub && <div className="text-muted text-[0.9rem] font-semibold mt-0.5">{sub}</div>}
      </div>
      <button onClick={onEdit} className="text-violet-500 font-bold underline underline-offset-4 p-1">Cambiar</button>
    </div>
  );
}

// Manchas de fondo
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-80">
      <div className="absolute w-[300px] h-[300px] bg-lav-300/30 rounded-full -left-[90px] -top-[100px]"></div>
      <div className="absolute w-[380px] h-[380px] bg-violet-500/20 rounded-full -right-[140px] -bottom-[120px]"></div>
      <div className="absolute w-[340px] h-[340px] bg-leaf/28 rounded-tr-full rounded-bl-full -left-[110px] -bottom-[90px] -rotate-12"></div>
      <div className="absolute w-[220px] h-[220px] bg-leaf/28 rounded-tl-full rounded-br-full right-[8%] bottom-[60px] rotate-18"></div>
    </div>
  );
}