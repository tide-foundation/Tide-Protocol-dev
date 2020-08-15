using System;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Tide.Usecase.Models;
using Tide.VendorSdk;
using Tide.VendorSdk.Classes;
using Tide.VendorSdk.Classes.Middleware;
using Tide.VendorSdk.Configuration;
using VueCliMiddleware;
using Westwind.AspNetCore.LiveReload;

namespace Tide.Usecase
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services) {

            var settings = new Settings();
            Configuration.Bind("Settings", settings);
            services.AddSingleton(settings);

            services.AddDbContext<VendorContext>(options => { options.UseSqlServer(settings.Connection, builder => builder.CommandTimeout(6000)); });

            // services.AddTide("VendorId", configuration => configuration.UseSqlServerStorage(settings.Connection));

            services.AddSingleton<IOrkRepo, OrkRepo>();
            services.AddTideEndpoint(settings.Keys.CreateVendorConfig());
            services.AddControllers();

            services.AddLiveReload();
            services.AddControllers();
            services.AddSpaStaticFiles(configuration =>
            {
                configuration.RootPath = "ClientApp/dist";
            });
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
           // app.UseTide();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseLiveReload();
            }

            app.UseRouting();
            app.UseSpaStaticFiles();
            app.UseAuthorization();

            //app.UseSpa(spa =>
            //{
            //    if (env.IsDevelopment())
            //        spa.Options.SourcePath = "ClientApp";
            //    else
            //        spa.Options.SourcePath = "dist";

            //    if (env.IsDevelopment())
            //    {
            //        spa.UseVueCli(npmScript: "serve");
            //    }

            //});


            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
        }
    }
}
