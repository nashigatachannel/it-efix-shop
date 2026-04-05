import {
  type Product,
  calcTaxIncluded,
  formatPrice,
} from "@/lib/products";

interface OptionCardProps {
  product: Product;
}

export default function OptionCard({ product }: OptionCardProps) {
  const taxIncluded = calcTaxIncluded(product.priceExTax);

  return (
    <article className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-white">{product.name}</h3>
        <p className="text-sm text-slate-400 mt-0.5">{product.description}</p>
        <ul
          className="flex flex-wrap gap-x-4 mt-2"
          aria-label={`${product.name}の特徴`}
        >
          {product.features.map((feature) => (
            <li key={feature} className="flex items-center gap-1 text-xs text-slate-400">
              <span className="text-emerald-500" aria-hidden="true">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="shrink-0 text-right sm:text-left">
        <p className="font-bold text-emerald-400">
          ¥{formatPrice(taxIncluded)}
          <span className="text-xs font-normal text-slate-400 ml-1">税込</span>
        </p>
      </div>
    </article>
  );
}
