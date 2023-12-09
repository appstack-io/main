import {
  JsonLoggerService,
  LoggingInterceptorGrpc,
  LoggingInterceptorHttp,
  otelSDK,
} from '@appstack-io/visibility';
import '@appstack-io/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import {
  AllExceptionsFilter,
  RpcExceptionsFilter,
} from '@appstack-io/exceptions';
import * as passport from 'passport';
import * as session from 'express-session';
import {
  HttpAuthExternalInterceptor,
  HttpAuthInternalInterceptor,
  RpcAuthExternalInterceptor,
  RpcAuthInternalInterceptor,
} from '@appstack-io/authnz';
import * as process from 'process';
import * as cookieParser from 'cookie-parser';

type Component = {
  clss: any;
  init: () => Promise<() => Promise<void>>;
  shutdown?: () => Promise<void>;
};

const components: Component[] = [];
const addComponent = (component: Component) => {
  if (component.clss) {
    components.push({
      shutdown: async () => {
        return;
      },
      ...component,
    });
  }
};

const initComponents = async () => {
  await Promise.all(
    components.map(async (component) => {
      const shutdown = await component.init();
      component.shutdown = shutdown;
    }),
  );
};

const shutdownComponents = async () => {
  console.log('graceful shutdown');
  await Promise.all(components.map((component) => component.shutdown()));
};

const main = async (opts: {
  publicMicroservicesModule?: any;
  privateMicroservicesModule?: any;
  publicHttpModule?: any;
  privateHttpModule?: any;
  workersModule?: any;
  pubsubModule?: any;
  ports: {
    proto: number;
    protoInternal: number;
    http: number;
    httpInternal: number;
    workers: number;
  };
  otel?: boolean;
}) => {
  if (opts.otel) otelSDK().start();

  addComponent({
    clss: opts.publicMicroservicesModule,
    init: async () => {
      const proto = await NestFactory.createMicroservice<MicroserviceOptions>(
        opts.publicMicroservicesModule,
        {
          transport: Transport.GRPC,
          options: {
            package: ['main'],
            protoPath: join(__dirname, '..', 'proto', `combined.proto`),
            url: `localhost:${opts.ports.proto}`,
          },
          logger: new JsonLoggerService(),
        },
      );
      proto.useGlobalFilters(new RpcExceptionsFilter());
      proto.useGlobalInterceptors(
        new LoggingInterceptorGrpc(),
        new RpcAuthExternalInterceptor(),
      );
      await proto.listen();
      return () => proto.close();
    },
  });

  addComponent({
    clss: opts.privateMicroservicesModule,
    init: async () => {
      const protoInternal =
        await NestFactory.createMicroservice<MicroserviceOptions>(
          opts.privateMicroservicesModule,
          {
            transport: Transport.GRPC,
            options: {
              package: ['main'],
              protoPath: join(__dirname, '..', 'proto', `combined.proto`),
              url: `localhost:${opts.ports.protoInternal}`,
            },
            logger: new JsonLoggerService(),
          },
        );
      protoInternal.useGlobalFilters(new RpcExceptionsFilter());
      protoInternal.useGlobalInterceptors(
        new LoggingInterceptorGrpc(),
        new RpcAuthInternalInterceptor(),
      );
      await protoInternal.listen();
      return () => protoInternal.close();
    },
  });

  addComponent({
    clss: opts.publicHttpModule,
    init: async () => {
      const http = await NestFactory.create(opts.publicHttpModule, {
        logger: new JsonLoggerService(),
      });
      http.enableCors({
        origin: process.env.WEB_CLIENT_URL,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Accept',
        credentials: true,
      });
      http.use(
        session({
          secret: process.env.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
        }),
      );
      http.use(cookieParser());
      http.use(passport.session());
      http.useGlobalFilters(new AllExceptionsFilter());
      http.useGlobalInterceptors(
        new LoggingInterceptorHttp(),
        new HttpAuthExternalInterceptor(),
      );
      await http.listen(opts.ports.http);
      return () => http.close();
    },
  });

  addComponent({
    clss: opts.privateHttpModule,
    init: async () => {
      const http = await NestFactory.create(opts.privateHttpModule, {
        logger: new JsonLoggerService(),
      });
      http.use(
        session({
          secret: process.env.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
        }),
      );
      http.use(passport.session());
      http.useGlobalFilters(new AllExceptionsFilter());
      http.useGlobalInterceptors(
        new LoggingInterceptorHttp(),
        new HttpAuthInternalInterceptor(),
      );
      await http.listen(opts.ports.httpInternal);
      return () => http.close();
    },
  });

  addComponent({
    clss: opts.workersModule,
    init: async () => {
      const workers = await NestFactory.createMicroservice<MicroserviceOptions>(
        opts.workersModule,
        {
          transport: Transport.GRPC,
          options: {
            package: ['main'],
            protoPath: join(__dirname, '..', 'proto', `combined.proto`),
            url: `localhost:${opts.ports.workers}`,
          },
          logger: new JsonLoggerService(),
        },
      );
      workers.useGlobalFilters(new RpcExceptionsFilter());
      workers.useGlobalInterceptors(new LoggingInterceptorGrpc());
      await workers.listen();
      return () => workers.close();
    },
  });

  addComponent({
    clss: opts.pubsubModule,
    init: async () => {
      const pubsub = await NestFactory.createApplicationContext(
        opts.pubsubModule,
        {
          logger: new JsonLoggerService(),
        },
      );
      await pubsub.init();
      return () => pubsub.close();
    },
  });

  await initComponents();
  return components;
};

export { main, shutdownComponents };

process.on('SIGTERM', shutdownComponents);
process.on('SIGINT', shutdownComponents);

process.on('uncaughtException', function (err) {
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', function (err) {
  console.error(err);
  process.exit(1);
});
