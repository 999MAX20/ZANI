import {
  ArrowRight,
  BadgeDollarSign,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  DoorOpen,
  Eye,
  Filter,
  Home,
  MapPin,
  Maximize2,
  Menu,
  Moon,
  Phone,
  Play,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useMemo, useState } from "react";

import "./dubaiRealEstate.css";

type Property = {
  id: number;
  title: string;
  district: string;
  type: string;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  roi: string;
  handover: string;
  ready: "ready" | "off-plan";
  developer: string;
  installment: boolean;
  hasTour: boolean;
  image: string;
  x: number;
  y: number;
};

type District = {
  name: string;
  description: string;
  price: string;
  roi: string;
  lifestyle: string;
  image: string;
};

const navItems = ["Купить", "Инвестиции", "Районы", "3D-туры", "О компании", "Контакты"];

const heroStats = [
  ["250+ объектов", "в премиальных районах"],
  ["от $180 000", "минимальный бюджет"],
  ["ROI до 8-12%", "арендная доходность"],
  ["3D-туры", "доступны онлайн"],
];

const properties: Property[] = [
  {
    id: 1,
    title: "Marina Sky Residences",
    district: "Dubai Marina",
    type: "Апартаменты",
    price: 420000,
    area: 82,
    bedrooms: 1,
    bathrooms: 2,
    roi: "8.4%",
    handover: "Q4 2026",
    ready: "off-plan",
    developer: "Emaar",
    installment: true,
    hasTour: true,
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=85",
    x: 41,
    y: 59,
  },
  {
    id: 2,
    title: "Palm Horizon Villas",
    district: "Palm Jumeirah",
    type: "Вилла",
    price: 1850000,
    area: 310,
    bedrooms: 4,
    bathrooms: 5,
    roi: "6.9%",
    handover: "Готовый",
    ready: "ready",
    developer: "Damac",
    installment: false,
    hasTour: true,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
    x: 28,
    y: 46,
  },
  {
    id: 3,
    title: "Downtown Boulevard",
    district: "Downtown Dubai",
    type: "Пентхаус",
    price: 980000,
    area: 145,
    bedrooms: 2,
    bathrooms: 3,
    roi: "7.6%",
    handover: "Q2 2027",
    ready: "off-plan",
    developer: "Ellington",
    installment: true,
    hasTour: true,
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85",
    x: 58,
    y: 42,
  },
  {
    id: 4,
    title: "Creek Harbour Lofts",
    district: "Creek Harbour",
    type: "Апартаменты",
    price: 315000,
    area: 68,
    bedrooms: 1,
    bathrooms: 1,
    roi: "8.9%",
    handover: "Q1 2026",
    ready: "off-plan",
    developer: "Emaar",
    installment: true,
    hasTour: false,
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85",
    x: 71,
    y: 55,
  },
  {
    id: 5,
    title: "Business Bay Canal",
    district: "Business Bay",
    type: "Студия",
    price: 220000,
    area: 44,
    bedrooms: 0,
    bathrooms: 1,
    roi: "9.1%",
    handover: "Готовый",
    ready: "ready",
    developer: "Sobha",
    installment: false,
    hasTour: true,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
    x: 54,
    y: 51,
  },
  {
    id: 6,
    title: "Dubai Hills Park Gate",
    district: "Dubai Hills",
    type: "Апартаменты",
    price: 560000,
    area: 118,
    bedrooms: 2,
    bathrooms: 2,
    roi: "7.8%",
    handover: "Q3 2026",
    ready: "off-plan",
    developer: "Meraas",
    installment: true,
    hasTour: false,
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85",
    x: 46,
    y: 72,
  },
];

const districts: District[] = [
  {
    name: "Downtown Dubai",
    description: "Башни, Burj Khalifa, высокий спрос на short-term аренду.",
    price: "от $420 000",
    roi: "7-9%",
    lifestyle: "city luxury",
    image: "https://images.unsplash.com/photo-1526495124232-a04e1849168c?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Dubai Marina",
    description: "Вид на воду, прогулочная набережная, стабильная ликвидность.",
    price: "от $300 000",
    roi: "8-10%",
    lifestyle: "waterfront",
    image: "https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Palm Jumeirah",
    description: "Виллы и резиденции у моря для жизни и премиальной аренды.",
    price: "от $850 000",
    roi: "5-7%",
    lifestyle: "beachfront",
    image: "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "JVC",
    description: "Рациональный входной бюджет и высокий спрос среди арендаторов.",
    price: "от $180 000",
    roi: "8-12%",
    lifestyle: "family",
    image: "https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?auto=format&fit=crop&w=900&q=85",
  },
];

const dealSteps = ["Консультация", "Подбор объектов", "Онлайн-просмотр / 3D-тур", "Бронирование", "Проверка документов", "Оплата", "Передача объекта"];

const benefits = [
  "отсутствие налога на доход от аренды",
  "высокий спрос на аренду",
  "рассрочки от застройщиков",
  "статус международного рынка",
  "рост стоимости недвижимости",
  "безопасная сделка",
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function DubaiHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="dubai-header">
      <a className="dubai-logo" href="#top" aria-label="Dubai Estate">
        <span>DE</span>
        <strong>Dubai Estate</strong>
      </a>
      <nav className="dubai-nav" aria-label="Основная навигация">
        {navItems.map((item) => (
          <button key={item} type="button" onClick={() => scrollToId(item === "Купить" ? "catalog" : item === "Контакты" ? "lead" : item === "3D-туры" ? "tour" : item === "Районы" ? "districts" : "invest")}>
            {item}
          </button>
        ))}
      </nav>
      <button className="dubai-header-cta" type="button" onClick={() => scrollToId("matching")}>
        Подобрать объект
      </button>
      <button className="dubai-menu" type="button" onClick={() => setOpen((value) => !value)} aria-label="Открыть меню">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open ? (
        <div className="dubai-mobile-nav">
          {navItems.map((item) => (
            <button key={item} type="button" onClick={() => { setOpen(false); scrollToId(item === "Купить" ? "catalog" : item === "Контакты" ? "lead" : item === "3D-туры" ? "tour" : item === "Районы" ? "districts" : "invest"); }}>
              {item}
            </button>
          ))}
          <button type="button" onClick={() => { setOpen(false); scrollToId("matching"); }}>
            Подобрать объект
          </button>
        </div>
      ) : null}
    </header>
  );
}

function PropertyCard({ property, featured = false }: { property: Property; featured?: boolean }) {
  return (
    <article className={featured ? "dubai-property-card featured" : "dubai-property-card"}>
      <div className="dubai-card-media">
        <img src={property.image} alt={property.title} loading="lazy" />
        <div className="dubai-card-badges">
          {property.hasTour ? <span>3D-тур</span> : null}
          {property.installment ? <span>Рассрочка</span> : null}
        </div>
      </div>
      <div className="dubai-card-body">
        <div>
          <p className="dubai-location"><MapPin size={14} />{property.district}</p>
          <h3>{property.title}</h3>
        </div>
        <div className="dubai-price-row">
          <strong>{money(property.price)}</strong>
          <span>{property.roi} ROI</span>
        </div>
        <dl className="dubai-specs">
          <div><Ruler size={15} /><dt>{property.area} м2</dt></div>
          <div><BedDouble size={15} /><dt>{property.bedrooms === 0 ? "студия" : `${property.bedrooms} спальни`}</dt></div>
          <div><CalendarDays size={15} /><dt>{property.handover}</dt></div>
        </dl>
        <div className="dubai-card-actions">
          <button type="button" onClick={() => scrollToId("tour")}>Смотреть 3D-тур</button>
          <button type="button" onClick={() => scrollToId("project")}>Подробнее</button>
        </div>
      </div>
    </article>
  );
}

function Catalog() {
  const [district, setDistrict] = useState("Все районы");
  const [tourOnly, setTourOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filtered = useMemo(
    () => properties.filter((property) => (district === "Все районы" || property.district === district) && (!tourOnly || property.hasTour)),
    [district, tourOnly],
  );
  const districtsList = ["Все районы", ...Array.from(new Set(properties.map((property) => property.district)))];

  const filters = (
    <div className="dubai-filter-stack">
      <label>
        Цена от / до
        <div className="dubai-range-row">
          <input value="$180 000" readOnly />
          <input value="$2 000 000" readOnly />
        </div>
      </label>
      <label>
        Район
        <select value={district} onChange={(event) => setDistrict(event.target.value)}>
          {districtsList.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Тип объекта
        <select defaultValue="Любой">
          <option>Любой</option>
          <option>Апартаменты</option>
          <option>Вилла</option>
          <option>Пентхаус</option>
        </select>
      </label>
      <label>
        Застройщик
        <select defaultValue="Любой">
          <option>Любой</option>
          <option>Emaar</option>
          <option>Damac</option>
          <option>Ellington</option>
          <option>Sobha</option>
        </select>
      </label>
      <button className={tourOnly ? "dubai-toggle active" : "dubai-toggle"} type="button" onClick={() => setTourOnly((value) => !value)}>
        <Check size={16} /> с 3D-туром
      </button>
      <button className="dubai-toggle" type="button">
        <Check size={16} /> с рассрочкой
      </button>
    </div>
  );

  return (
    <section className="dubai-section dubai-catalog" id="catalog">
      <div className="dubai-section-head">
        <h2>Каталог объектов</h2>
        <p>Фильтры, карточки и карта работают как главный раздел подбора.</p>
      </div>
      <button className="dubai-filter-open" type="button" onClick={() => setDrawerOpen(true)}>
        <Filter size={18} /> Фильтры
      </button>
      <div className="dubai-catalog-grid">
        <aside className="dubai-filters">{filters}</aside>
        <div className="dubai-cards-grid">
          {filtered.map((property) => <PropertyCard key={property.id} property={property} />)}
        </div>
        <aside className="dubai-map" aria-label="Карта объектов">
          <div className="dubai-map-grid" />
          {filtered.map((property) => (
            <button key={property.id} className="dubai-map-pin" style={{ left: `${property.x}%`, top: `${property.y}%` }} type="button">
              {money(property.price).replace(",000", "k")}
            </button>
          ))}
          <div className="dubai-map-note">
            <MapPin size={16} />
            <span>Карта: pin-карточки, фильтрация по району и цена на карте.</span>
          </div>
        </aside>
      </div>
      {drawerOpen ? (
        <div className="dubai-drawer" role="dialog" aria-modal="true">
          <button className="dubai-drawer-backdrop" type="button" aria-hidden="true" tabIndex={-1} onClick={() => setDrawerOpen(false)} />
          <div className="dubai-drawer-panel">
            <div className="dubai-drawer-head">
              <strong>Фильтры</strong>
              <button type="button" aria-label="Закрыть фильтры" onClick={() => setDrawerOpen(false)}><X size={20} /></button>
            </div>
            {filters}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TourBlock() {
  const [loaded, setLoaded] = useState(false);
  const [night, setNight] = useState(false);

  return (
    <section className="dubai-section dubai-tour-section" id="tour">
      <div className="dubai-tour-copy">
        <h2>Смотрите объект до покупки - как будто вы уже внутри.</h2>
        <p>360° просмотр, переход между комнатами, точки интереса, планировка, вид из окна и переключение день/ночь.</p>
        <div className="dubai-tour-actions">
          <button type="button" onClick={() => setLoaded(true)}><Play size={18} /> Открыть 3D-тур</button>
          <button type="button" onClick={() => scrollToId("lead")}><Phone size={18} /> Оставить заявку</button>
        </div>
      </div>
      <div className={night ? "dubai-tour-view night" : "dubai-tour-view"}>
        {loaded ? (
          <>
            <div className="dubai-tour-panorama">
              <span className="hotspot living">Гостиная</span>
              <span className="hotspot view">Вид из окна</span>
              <span className="hotspot kitchen">Кухня</span>
            </div>
            <div className="dubai-tour-controls">
              <button type="button" onClick={() => setNight((value) => !value)}>{night ? <Sun size={17} /> : <Moon size={17} />} День / ночь</button>
              <button type="button"><Maximize2 size={17} /> Fullscreen</button>
            </div>
          </>
        ) : (
          <button className="dubai-tour-loader" type="button" onClick={() => setLoaded(true)}>
            <Play size={26} /> Загрузить 3D-тур
          </button>
        )}
        <div className="dubai-floorplan">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

function LeadForm({ compact = false }: { compact?: boolean }) {
  return (
    <form className={compact ? "dubai-lead-form compact" : "dubai-lead-form"} onSubmit={(event) => event.preventDefault()}>
      <label>Имя<input placeholder="Ваше имя" /></label>
      <label>Телефон<input placeholder="+971" /></label>
      {!compact ? <label>WhatsApp<input placeholder="+971" /></label> : null}
      <label>Бюджет<input placeholder="от $180 000" /></label>
      <label>Цель покупки<select defaultValue="инвестировать"><option>жить</option><option>инвестировать</option><option>сдавать</option><option>перепродажа</option></select></label>
      {!compact ? <label className="full">Комментарий<textarea placeholder="Район, сроки, тип объекта" /></label> : null}
      <button type="submit"><Send size={18} /> Получить подборку объектов</button>
    </form>
  );
}

export function DubaiRealEstatePage() {
  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 80, damping: 25 });
  const heroShift = useTransform(smoothY, [0, 700], [0, 110]);

  return (
    <main className="dubai-page" id="top">
      <DubaiHeader />
      <section className="dubai-hero">
        <motion.div className="dubai-hero-bg" style={{ y: heroShift }} />
        <div className="dubai-hero-shade" />
        <div className="dubai-hero-content">
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="dubai-hero-copy">
            <p className="dubai-hero-label">Dubai Marina / Downtown / Palm Jumeirah</p>
            <h1>Недвижимость в Дубае для жизни и инвестиций</h1>
            <p>Подберите апартаменты, виллу или инвестиционный объект с 3D-туром, аналитикой доходности и сопровождением сделки под ключ.</p>
            <div className="dubai-hero-actions">
              <button type="button" onClick={() => scrollToId("catalog")}>Смотреть объекты <ArrowRight size={18} /></button>
              <button type="button" onClick={() => scrollToId("matching")}>Получить подборку</button>
            </div>
          </motion.div>
          <div className="dubai-hero-panel" aria-label="Показатели каталога">
            {heroStats.map(([value, label]) => (
              <div key={value}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dubai-section dubai-best">
        <div className="dubai-section-head">
          <h2>Лучшие предложения</h2>
          <p>Карточки показывают цену, район, площадь, спальни, доходность и доступность 3D-тура.</p>
        </div>
        <div className="dubai-best-grid">
          {properties.slice(0, 3).map((property) => <PropertyCard key={property.id} property={property} featured />)}
        </div>
      </section>

      <section className="dubai-section dubai-matching" id="matching">
        <div>
          <h2>Интерактивный подбор</h2>
          <p>Выберите бюджет, цель покупки, район, тип объекта, срок сдачи и рассрочку.</p>
        </div>
        <div className="dubai-matching-panel">
          <div className="dubai-choice-grid">
            {["жить", "инвестировать", "сдавать", "перепродажа"].map((item) => <button key={item} type="button">{item}</button>)}
          </div>
          <LeadForm compact />
          <a className="dubai-whatsapp" href="https://wa.me/" target="_blank" rel="noreferrer">Получить подборку в WhatsApp <ChevronRight size={18} /></a>
        </div>
      </section>

      <section className="dubai-section dubai-districts" id="districts">
        <div className="dubai-section-head">
          <h2>Районы Дубая</h2>
          <p>Downtown Dubai, Dubai Marina, Palm Jumeirah, Business Bay, JVC, Dubai Hills и Creek Harbour.</p>
        </div>
        <div className="dubai-district-grid">
          {districts.map((districtItem) => (
            <article key={districtItem.name} className="dubai-district-card">
              <img src={districtItem.image} alt={districtItem.name} loading="lazy" />
              <div>
                <h3>{districtItem.name}</h3>
                <p>{districtItem.description}</p>
                <dl>
                  <div><dt>Средняя цена</dt><dd>{districtItem.price}</dd></div>
                  <div><dt>Доходность</dt><dd>{districtItem.roi}</dd></div>
                  <div><dt>Lifestyle</dt><dd>{districtItem.lifestyle}</dd></div>
                </dl>
                <button type="button" onClick={() => scrollToId("catalog")}>Смотреть объекты</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dubai-section dubai-invest" id="invest">
        <div className="dubai-invest-card">
          <h2>Почему Дубай</h2>
          <div className="dubai-benefit-grid">
            {benefits.map((benefit) => (
              <div key={benefit}><ShieldCheck size={20} /><span>{benefit}</span></div>
            ))}
          </div>
        </div>
        <div className="dubai-invest-card dark">
          <h2>Инвестиционный блок</h2>
          <div className="dubai-invest-metrics">
            <div><TrendingUp size={20} /><strong>8.4%</strong><span>ожидаемая доходность</span></div>
            <div><Home size={20} /><strong>$3 200</strong><span>средняя аренда</span></div>
            <div><BadgeDollarSign size={20} /><strong>9 лет</strong><span>срок окупаемости</span></div>
            <div><Building2 size={20} /><strong>Q4 2026</strong><span>платежный план</span></div>
          </div>
        </div>
      </section>

      <TourBlock />

      <section className="dubai-section dubai-project" id="project">
        <div className="dubai-project-media">
          <img src={properties[0].image} alt="Marina Sky Residences" loading="lazy" />
          <button type="button" onClick={() => scrollToId("tour")}><Eye size={18} /> Смотреть 3D-тур</button>
        </div>
        <div className="dubai-project-copy">
          <p className="dubai-location"><MapPin size={14} /> Dubai Marina</p>
          <h2>Marina Sky Residences</h2>
          <p>Галерея: экстерьер, интерьер, вид из окна, инфраструктура, планировки, карта и видео.</p>
          <div className="dubai-layouts">
            {[
              ["1 спальня", "82 м2", "$420 000", "доступно"],
              ["2 спальни", "118 м2", "$610 000", "забронировано"],
              ["3 спальни", "164 м2", "$890 000", "продано"],
            ].map(([rooms, area, price, status]) => (
              <div key={rooms}><DoorOpen size={18} /><strong>{rooms}</strong><span>{area}</span><span>{price}</span><em>{status}</em></div>
            ))}
          </div>
        </div>
      </section>

      <Catalog />

      <section className="dubai-section dubai-steps">
        <h2>Как проходит сделка</h2>
        <div className="dubai-steps-line">
          {dealSteps.map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="dubai-section dubai-lead" id="lead">
        <div>
          <h2>Личный подбор объекта</h2>
          <p>Оставьте заявку: имя, телефон, WhatsApp, бюджет, цель покупки и комментарий.</p>
          <div className="dubai-contact-strip">
            <span><Phone size={17} /> WhatsApp</span>
            <span><Send size={17} /> Telegram</span>
            <span><Compass size={17} /> CRM</span>
            <span><Sparkles size={17} /> PDF-презентация</span>
          </div>
        </div>
        <LeadForm />
      </section>

      <a className="dubai-sticky-cta" href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a>
    </main>
  );
}
