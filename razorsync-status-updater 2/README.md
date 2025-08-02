# RazorSync Status Updater

A React web application for updating work order statuses in RazorSync via API integration. Built with Vite, React, Tailwind CSS, and Supabase.

## Features

- **Batch Status Updates**: Select multiple work orders and update their statuses simultaneously
- **Individual Work Order Lookup**: Search by RazorSync ID or Custom ID to view and update specific work orders
- **Real-time Data**: Pulls work order data from your Supabase database
- **Status Management**: Complete status lookup with visual indicators for complete/incomplete statuses
- **Delete Functionality**: Remove work orders with confirmation dialogs
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Supabase project with RazorSync data
- RazorSync API token

### 2. Installation

```bash
# Clone or download the project files
cd razorsync-status-updater

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
```

### 3. Environment Configuration

Edit `.env.local` with your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORSYNC_TOKEN=4442a145-bf1b-4cc4-bfd1-026587d5b037
VITE_RAZORSYNC_HOST=vallus.0.razorsync.com
VITE_RAZORSYNC_SERVER=vallus
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Schema

The app queries these Supabase tables:

- `rs_work_orders` - Main work orders table with RazorSync data
- `rs_status_lookup` - Status descriptions and completion flags  
- `fieldworkers` - Field worker information

## API Integration

The app integrates with RazorSync's REST API to:

- Update work order statuses
- Delete work orders
- Retrieve work order details

API calls use proper authentication headers and include error handling with retry logic for batch operations.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Netlify

1. Build: `npm run build`
2. Deploy `dist` folder to Netlify
3. Set environment variables

### Self-Hosted

1. Build: `npm run build`
2. Serve the `dist` folder with any web server

## Project Structure

```
src/
├── components/
│   └── RazorSyncStatusUpdater.jsx  # Main app component
├── services/
│   ├── supabase.js                 # Database queries
│   └── razorsync.js                # RazorSync API integration
├── hooks/
│   ├── useWorkOrders.js            # Work order data management
│   └── useNotifications.js         # Toast notifications
├── App.jsx                         # App entry point
└── index.css                       # Tailwind CSS styles
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Security

- API tokens stored as environment variables
- Rate limiting for batch operations
- Input validation and error handling
- Confirmation dialogs for destructive actions

## Support

For issues or questions about the RazorSync integration, refer to:
- RazorSync API documentation
- Supabase documentation
- Your metabase report: https://reports.vallus.com/question/95-incomplete-events-detail-list-modified