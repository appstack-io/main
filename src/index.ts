import '@appstack-io/config';
import { MainGrpcModule } from './grpc/main.grpc.module';

(async () => {
  const { main } = await import('./main');
  await main({
    publicMicroservicesModule: MainGrpcModule,
    ports: {
      proto: Number(process.env.PROTO_PORT),
      protoInternal: Number(process.env.PROTO_INTERNAL_PORT),
      http: Number(process.env.HTTP_PORT),
      httpInternal: Number(process.env.HTTP_INTERNAL_PORT),
      workers: Number(process.env.WORKERS_PORT),
    },
    otel: true,
  });
})();
