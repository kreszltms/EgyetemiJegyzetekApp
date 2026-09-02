import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A fejlesztői mód bal alsó sarokban megjelenő "N" jelzője ütközött a
  // Sidebar footer gombjaival (téma váltó, import/export) ugyanabban a
  // sarokban — inkább teljesen kikapcsoljuk. A build/futásidejű hibák
  // ettől függetlenül továbbra is megjelennek.
  devIndicators: false,
};

export default nextConfig;
