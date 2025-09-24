/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    javascript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;
