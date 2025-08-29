# Image editing UI

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Setup

### Environment Variables

To use this app, you need to configure your FAL AI API key:

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your FAL API key:
   ```
   FAL_KEY=your_actual_fal_api_key_here
   ```

3. Get your API key from [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)

Alternatively, you can set your API key through the app's settings dialog (gear icon in the top right).

## Deployment

Your project is live at:

**[https://v0-for-images.vercel.app](https://v0-for-images.vercel.app)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/v0-for-images-jHj6h2PDnUc](https://v0.app/chat/v0-for-images-jHj6h2PDnUc)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
