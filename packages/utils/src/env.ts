export const env = process.env.NODE_ENV === 'development' ? 'development' : 'production';
export const isProduction = env === 'production';