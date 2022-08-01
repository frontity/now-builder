# Frontity - Now builder

Use this builder to deploy a [Frontity](https://frontity.org) project in the Vercel. From from [@frontity/now](https://github.com/frontity/now-builder)

## Before deploying

1. Create this `vercel.json` file in your project and change the site url:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@donkoko/now"
    }
  ]
}
```
