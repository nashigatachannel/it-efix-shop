import {
  type Product,
  calcTaxIncluded,
  formatPrice,
} from "@/lib/products";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export default function ProductCard({ product, featured = false }: ProductCardProps) {
  const taxIncluded = calcTaxIncluded(product.priceExTax);

  return (
    <article
      className={`rounded-2xl border flex flex-col ${
        featured
          ? "border-emerald-500/60 bg-gradient-to-b from-emerald-950/40 to-slate-800/60 shadow-lg shadow-emerald-900/30"
          : "border-slate-700/50 bg-slate-800/50"
      } p-6`}
    >
      {featured && (
        <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-3">
          Most Advanced
        </p>
      )}
      <h3 className="text-xl font-bold text-white">{product.name}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">
        {product.description}
      </p>

      <ul className="mt-4 space-y-1.5 flex-1" aria-label={`${product.name}の特徴`}>
        {product.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
            <span className="text-emerald-400 mt-0.5 shrink-0" aria-hidden="true">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-slate-700/50 pt-4">
        <p className="text-lg font-bold text-emerald-400">
          ¥{formatPrice(taxIncluded)}
          <span className="text-xs font-normal text-slate-400 ml-1">税込</span>
        </p>
      </div>

    </article>
  );
}
