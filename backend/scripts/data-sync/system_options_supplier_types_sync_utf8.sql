-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: erp
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `system_options`
--
-- WHERE:  option_type='supplier_types'

LOCK TABLES `system_options` WRITE;
/*!40000 ALTER TABLE `system_options` DISABLE KEYS */;
REPLACE INTO `system_options` VALUES (25,'supplier_types','面料供应商',0,NULL),(26,'supplier_types','针织',0,25),(27,'supplier_types','辅料供应商',1,NULL),(28,'supplier_types','工艺供应商',2,NULL),(32,'supplier_types','亚麻',1,25),(35,'supplier_types','成品供应商',4,NULL),(36,'supplier_types','商标',0,27),(37,'supplier_types','吊牌',1,27),(38,'supplier_types','洗水唛',2,27),(43,'supplier_types','绣花',3,28),(65,'supplier_types','单面',0,26),(66,'supplier_types','印花',4,28),(67,'supplier_types','丝网胶浆印',2,66),(68,'supplier_types','丝网水浆印',3,66),(69,'supplier_types','烫画',0,66),(70,'supplier_types','烫钻',5,66),(71,'supplier_types','植绒',6,66),(72,'supplier_types','3D立体绣',1,43),(73,'supplier_types','贴布绣',2,43),(74,'supplier_types','毛巾绣',3,43),(75,'supplier_types','平绣',0,43),(76,'supplier_types','直喷',1,66),(77,'supplier_types','厚板硅胶印',4,66),(216,'supplier_types','加工供应商',5,NULL),(217,'supplier_types','辅料',2,27),(218,'supplier_types','绣花',3,25),(219,'supplier_types','印花',4,25),(220,'supplier_types','开凤眼',5,25),(221,'supplier_types','打条',6,25),(222,'supplier_types','打揽',7,25),(223,'supplier_types','胶袋',8,25),(224,'supplier_types','裁床用纸',9,25),(225,'supplier_types','办公室用品',10,25),(226,'supplier_types','包装耗材',11,25),(227,'supplier_types','里布',12,25),(228,'supplier_types','衬朴',13,25),(229,'supplier_types','缩水',14,25),(230,'supplier_types','面料',15,25),(231,'supplier_types','洗水',16,25),(232,'supplier_types','梳织布',17,25),(233,'supplier_types','B布料',18,25),(234,'supplier_types','A布料',19,25),(235,'supplier_types','针织布',20,25),(236,'supplier_types','毛毛布',21,25),(237,'supplier_types','C布料',22,25),(238,'supplier_types','包扣',23,25),(239,'supplier_types','烧花',24,25),(240,'supplier_types','成品卫衣',25,25),(241,'supplier_types','成品衬衣',26,25),(242,'supplier_types','成品连衣裙',27,25),(243,'supplier_types','成品裤子',28,25),(244,'supplier_types','数码印花',29,25),(245,'supplier_types','手摇花',30,25),(246,'supplier_types','防起球',31,25),(247,'supplier_types','防污工艺',32,25),(248,'supplier_types','A - 裁至包装 | CTM:1.80 | FOB:0.90',1,216),(249,'supplier_types','D - 车缝 | CTM:2.00 | FOB:0.95',2,216),(250,'supplier_types','B - 裁至包装 | CTM:1.80 | FOB:0.96',3,216),(251,'supplier_types','C - 车缝至包装 | CTM:1.60 | FOB:0.95',4,216),(252,'supplier_types','E - 车缝 | CTM:1.40 | FOB:0.94',5,216);
/*!40000 ALTER TABLE `system_options` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-26 23:59:12
