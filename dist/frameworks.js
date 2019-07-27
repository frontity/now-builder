"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const util_1 = require("util");
const path_1 = require("path");
const readirPromise = util_1.promisify(fs_1.readdir);
const statPromise = util_1.promisify(fs_1.stat);
const isDir = async (file) => (await statPromise(file)).isDirectory();
// Please note that is extremely important
// that the `dependency` property needs
// to reference a CLI. This is needed because
// you might want (for example) a Gatsby
// site that is powered by Preact, so you
// can't look for the `preact` dependency.
// Instead, you need to look for `preact-cli`
// when optimizing Preact CLI projects.
exports.default = [
    {
        name: 'Gatsby.js',
        dependency: 'gatsby',
        getOutputDirName: async () => 'public',
    },
    {
        name: 'Hexo',
        dependency: 'hexo',
        getOutputDirName: async () => 'public',
    },
    {
        name: 'Docusaurus 2.0',
        dependency: '@docusaurus/core',
        getOutputDirName: async () => 'build',
    },
    {
        name: 'Preact',
        dependency: 'preact-cli',
        getOutputDirName: async () => 'build',
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Ember',
        dependency: 'ember-cli',
        getOutputDirName: async () => 'dist',
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Vue.js',
        dependency: '@vue/cli-service',
        getOutputDirName: async () => 'dist',
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '^/js/(.*)',
                headers: { 'cache-control': 'max-age=31536000, immutable' },
                dest: '/js/$1',
            },
            {
                src: '^/css/(.*)',
                headers: { 'cache-control': 'max-age=31536000, immutable' },
                dest: '/css/$1',
            },
            {
                src: '^/img/(.*)',
                headers: { 'cache-control': 'max-age=31536000, immutable' },
                dest: '/img/$1',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Angular',
        dependency: '@angular/cli',
        minNodeRange: '10.x',
        getOutputDirName: async (dirPrefix) => {
            const base = 'dist';
            const location = path_1.join(dirPrefix, base);
            const content = await readirPromise(location);
            // If there is only one file in it that is a dir we'll use it as dist dir
            if (content.length === 1 && (await isDir(path_1.join(location, content[0])))) {
                return path_1.join(base, content[0]);
            }
            return base;
        },
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Polymer',
        dependency: 'polymer-cli',
        getOutputDirName: async (dirPrefix) => {
            const base = 'build';
            const location = path_1.join(dirPrefix, base);
            const content = await readirPromise(location);
            const paths = content.filter(item => !item.includes('.'));
            return path_1.join(base, paths[0]);
        },
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Svelte',
        dependency: 'sirv-cli',
        getOutputDirName: async () => 'public',
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Create React App',
        dependency: 'react-scripts',
        getOutputDirName: async () => 'build',
        defaultRoutes: [
            {
                src: '/static/(.*)',
                headers: { 'cache-control': 's-maxage=31536000, immutable' },
                dest: '/static/$1',
            },
            {
                src: '/favicon.ico',
                dest: '/favicon.ico',
            },
            {
                src: '/asset-manifest.json',
                dest: '/asset-manifest.json',
            },
            {
                src: '/manifest.json',
                dest: '/manifest.json',
            },
            {
                src: '/precache-manifest.(.*)',
                dest: '/precache-manifest.$1',
            },
            {
                src: '/service-worker.js',
                headers: { 'cache-control': 's-maxage=0' },
                dest: '/service-worker.js',
            },
            {
                src: '/sockjs-node/(.*)',
                dest: '/sockjs-node/$1',
            },
            {
                src: '/(.*)',
                headers: { 'cache-control': 's-maxage=0' },
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Gridsome',
        dependency: 'gridsome',
        getOutputDirName: async () => 'dist',
    },
    {
        name: 'UmiJS',
        dependency: 'umi',
        getOutputDirName: async () => 'dist',
        defaultRoutes: [
            {
                handle: 'filesystem',
            },
            {
                src: '/(.*)',
                dest: '/index.html',
            },
        ],
    },
    {
        name: 'Docusaurus 1.0',
        dependency: 'docusaurus',
        getOutputDirName: async (dirPrefix) => {
            const base = 'build';
            const location = path_1.join(dirPrefix, base);
            const content = await readirPromise(location);
            // If there is only one file in it that is a dir we'll use it as dist dir
            if (content.length === 1 && (await isDir(path_1.join(location, content[0])))) {
                return path_1.join(base, content[0]);
            }
            return base;
        },
    },
];
