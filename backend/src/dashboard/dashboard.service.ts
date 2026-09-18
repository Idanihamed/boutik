import { Inject, Injectable } from '@nestjs/common';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionsService } from '../promotions/promotions.service';
import { BoutiquesService } from '../boutiques/boutiques.service';
import { ArticlesService } from '../articles/articles.service';
import { PagesService } from '../pages/pages.service';
import { ContactMessagesService } from '../contact-messages/contact-messages.service';
import { OrdersService } from '../orders/orders.service';
import { computeStockStatus } from '../common/utils/stock-status.util';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly promotionsService: PromotionsService,
    private readonly boutiquesService: BoutiquesService,
    private readonly articlesService: ArticlesService,
    private readonly pagesService: PagesService,
    private readonly contactMessagesService: ContactMessagesService,
    private readonly ordersService: OrdersService,
  ) {}

  /** Statistiques du tableau de bord (§25 du cahier des charges). */
  async getStats(callerPermissions: string[] = []) {
    const [
      [totalProducts, publishedProducts, draftProducts, allProducts, totalCategories, totalBrands],
      promotions,
      boutiques,
      articles,
      pages,
      untreatedMessages,
      pendingOrders,
    ] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.product.count({ where: { status: 'DRAFT' } }),
        this.prisma.product.findMany({ select: { stock: true, lowStockThreshold: true } }),
        this.prisma.category.count(),
        this.prisma.brand.count(),
      ]),
      this.promotionsService.countByDisplayStatus(),
      this.boutiquesService.count(),
      this.articlesService.count(),
      this.pagesService.count(),
      this.contactMessagesService.countUntreated(),
      this.ordersService.countPending(),
    ]);

    let lowStock = 0;
    let outOfStock = 0;
    for (const p of allProducts) {
      const status = computeStockStatus(p.stock, p.lowStockThreshold);
      if (status === 'STOCK_FAIBLE') lowStock += 1;
      if (status === 'RUPTURE') outOfStock += 1;
    }

    // Chaque section n'est renvoyée que si l'appelant détient la permission de lecture
    // correspondante (§27) : la route n'exige que `products:read` (voir DashboardController),
    // ce qui suffit pour l'accès à /admin/dashboard mais ne devrait pas suffire à voir les
    // compteurs de TOUTES les ressources — un rôle comme Éditeur (qui n'a pas
    // `promotions:read` ni `messages:read`) verrait sinon apparaître ces chiffres sur son
    // tableau de bord alors qu'il n'a pas le droit de consulter ces ressources directement.
    // Une section masquée est renvoyée à zéro plutôt qu'omise, pour ne pas casser la forme de
    // réponse attendue par le front-end (type DashboardStats).
    const has = (permission: string) => callerPermissions.includes(permission);

    return {
      products: has('products:read')
        ? { total: totalProducts, published: publishedProducts, draft: draftProducts }
        : { total: 0, published: 0, draft: 0 },
      stock: has('products:read') ? { lowStock, outOfStock } : { lowStock: 0, outOfStock: 0 },
      categories: has('categories:read') ? totalCategories : 0,
      brands: has('brands:read') ? totalBrands : 0,
      promotions: has('promotions:read') ? promotions : { active: 0, scheduled: 0 },
      boutiques: has('boutiques:read') ? boutiques : 0,
      articles: has('articles:read') ? articles : { total: 0, published: 0 },
      pages: has('pages:read') ? pages : 0,
      messages: has('messages:read') ? { untreated: untreatedMessages } : { untreated: 0 },
      orders: has('orders:read') ? { pending: pendingOrders } : { pending: 0 },
    };
  }
}
