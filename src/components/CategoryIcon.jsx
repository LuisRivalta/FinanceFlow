import {
    Utensils, Car, Home, Pill, Theater, BookOpen, Receipt, ShoppingBag,
    Briefcase, Laptop, Gift, Coins, TrendingUp, Bitcoin, Landmark, Rocket,
    Banknote, PiggyBank, CreditCard, Folder, Pin, HardHat, Building2,
    BarChart3, Package, Pencil, Circle
} from 'lucide-react';

// Resolve o `iconName` que vem dos módulos de dados (helpers.js,
// investmentProducts.js) para o componente lucide correspondente.
//
// Os dados guardam uma STRING, não o componente, de propósito: helpers.js e
// investmentProducts.js são módulos puros, importados por testes que rodam em
// ambiente node sem JSX. Manter lucide fora deles preserva isso.
//
// O mapa é explícito em vez de indexar o pacote inteiro por nome, para que o
// tree-shaking continue levando só os ícones realmente usados.
const ICONS = {
    Utensils, Car, Home, Pill, Theater, BookOpen, Receipt, ShoppingBag,
    Briefcase, Laptop, Gift, Coins, TrendingUp, Bitcoin, Landmark, Rocket,
    Banknote, PiggyBank, CreditCard, Folder, Pin, HardHat, Building2,
    BarChart3, Package, Pencil
};

export default function CategoryIcon({ name, size = 16, strokeWidth = 1.8, ...rest }) {
    const Cmp = ICONS[name] || Circle;
    return <Cmp size={size} strokeWidth={strokeWidth} {...rest} />;
}
