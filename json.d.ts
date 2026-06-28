// Bundled JSON (star-map data) is loaded by esbuild's JSON loader; tell tsc it's `any`
// so it doesn't try to infer a type for the large catalogue files.
declare module "*.json" {
  const value: any;
  export default value;
}

declare module "*.png" {
  const value: string;   // esbuild dataurl loader → a data: URL string
  export default value;
}
