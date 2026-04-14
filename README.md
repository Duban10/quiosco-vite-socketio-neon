# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


correr el servidor con node index.js
correr el cliente con npm run dev

- Cuando se hace un cambio en los modelos de prisma hay que hacer una migracion con: npx prisma migrate dev
- abrir modelo para validar los datos en prisma studio con: npx prisma studio
- ZOD se utiliza para validar los datos en el backend, es decir, en el server como en el client (npm i zod)
- En el schema se define el schema de los datos que se van a validar, en este caso, el schema de los datos que se van a validar en el backend es el OrderSchema
- Instalar toast para las notificaciones (npm i react-toastify)

npm run restore -- para restaurar la info en la BD
