-- MySQL dump 10.13  Distrib 5.6.50, for Linux (x86_64)
--
-- Host: localhost    Database: hyfsmes
-- ------------------------------------------------------
-- Server version	5.6.50-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `erp_auth_extend`
--

DROP TABLE IF EXISTS `erp_auth_extend`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_auth_extend` (
  `group_id` mediumint(10) unsigned NOT NULL COMMENT '用户id',
  `extend_id` mediumint(8) unsigned NOT NULL COMMENT '扩展表中数据的id',
  `type` tinyint(1) unsigned NOT NULL COMMENT '扩展类型标识 1:栏目分类权限;2:模型权限',
  UNIQUE KEY `group_extend_type` (`group_id`,`extend_id`,`type`),
  KEY `uid` (`group_id`),
  KEY `group_id` (`extend_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='用户组与分类的对应关系表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_auth_group`
--

DROP TABLE IF EXISTS `erp_auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_auth_group` (
  `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT COMMENT '用户组id,自增主键',
  `module` varchar(20) NOT NULL COMMENT '用户组所属模块',
  `type` tinyint(4) NOT NULL COMMENT '组类型',
  `title` char(20) NOT NULL DEFAULT '' COMMENT '用户组中文名称',
  `description` varchar(80) NOT NULL DEFAULT '' COMMENT '描述信息',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '用户组状态：为1正常，为0禁用,-1为删除',
  `rules` text COMMENT '用户组拥有的规则id，多个规则 , 隔开',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=84 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_auth_group_access`
--

DROP TABLE IF EXISTS `erp_auth_group_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_auth_group_access` (
  `uid` int(10) unsigned NOT NULL COMMENT '用户id',
  `group_id` mediumint(8) unsigned NOT NULL COMMENT '用户组id',
  UNIQUE KEY `uid_group_id` (`uid`,`group_id`),
  KEY `uid` (`uid`),
  KEY `group_id` (`group_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_auth_rule`
--

DROP TABLE IF EXISTS `erp_auth_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_auth_rule` (
  `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT COMMENT '规则id,自增主键',
  `module` varchar(20) NOT NULL COMMENT '规则所属module',
  `type` tinyint(2) NOT NULL DEFAULT '1' COMMENT '1-url;2-主菜单',
  `name` char(80) NOT NULL DEFAULT '' COMMENT '规则唯一英文标识',
  `title` char(20) NOT NULL DEFAULT '' COMMENT '规则中文描述',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否有效(0:无效,1:有效)',
  `condition` varchar(300) NOT NULL DEFAULT '' COMMENT '规则附加条件',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`module`,`name`,`type`)
) ENGINE=MyISAM AUTO_INCREMENT=747 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_factory`
--

DROP TABLE IF EXISTS `erp_factory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_factory` (
  `factory_id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '加工厂id',
  `grade_name` char(2) NOT NULL COMMENT '加工级别',
  `factory_name` char(20) DEFAULT '' COMMENT '加工厂名称',
  `service_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '服务员工',
  `opt_user_id` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '操作人',
  `status` tinyint(1) DEFAULT '0' COMMENT '-1删除 0禁用 1正常',
  `sort` smallint(5) DEFAULT '100' COMMENT '排序',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `factory_phone` char(15) DEFAULT '' COMMENT '加工厂电话',
  `factory_address` varchar(255) DEFAULT '' COMMENT '加工厂地址',
  `remark` text COMMENT '备注',
  PRIMARY KEY (`factory_id`)
) ENGINE=InnoDB AUTO_INCREMENT=302 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_add_subtract`
--

DROP TABLE IF EXISTS `erp_financial_add_subtract`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_add_subtract` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `financial_no` int(11) NOT NULL COMMENT '扣款单号',
  `type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1补款2扣款',
  `order_id` int(10) NOT NULL DEFAULT '0',
  `order_no` char(50) NOT NULL DEFAULT '' COMMENT '订单号',
  `design_no` char(50) NOT NULL DEFAULT '' COMMENT '设计款号',
  `project_id` int(10) NOT NULL DEFAULT '0' COMMENT '原因类型',
  `check_user_id` int(10) NOT NULL DEFAULT '0',
  `check_user_name` char(20) NOT NULL DEFAULT '' COMMENT '审核人',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `habiliment_number` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '件数',
  `unit_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '单价',
  `branch_id_1` int(11) NOT NULL DEFAULT '0',
  `branch_name_1` char(20) NOT NULL DEFAULT '' COMMENT '加工厂',
  `produce_responsible_person` char(20) NOT NULL DEFAULT '' COMMENT '生产主管',
  `produce_person` char(20) NOT NULL DEFAULT '' COMMENT '生产跟单人',
  `reason_remake` text COMMENT '原因备注',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `opt_user_id` int(11) NOT NULL DEFAULT '0',
  `opt_user_name` char(20) NOT NULL DEFAULT '' COMMENT '创建人',
  `amount` float(8,2) DEFAULT '0.00' COMMENT '补款金额',
  `check_status` tinyint(1) DEFAULT '0' COMMENT '审核状态',
  `split_type` char(20) NOT NULL DEFAULT '' COMMENT '分单类型',
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `order_no` (`order_no`),
  KEY `branch_id_1` (`branch_id_1`),
  KEY `opt_user_name` (`opt_user_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2166 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_borrow`
--

DROP TABLE IF EXISTS `erp_financial_borrow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_borrow` (
  `borrow_id` int(11) NOT NULL AUTO_INCREMENT,
  `borrow_amount` decimal(8,2) DEFAULT '0.00' COMMENT '借款金额',
  `borrow_reason` char(100) DEFAULT '' COMMENT '借款事由',
  `borrow_user_name` char(30) DEFAULT '' COMMENT '借款人姓名',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '申请人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '申请人姓名',
  `opt_remark` varchar(500) DEFAULT '' COMMENT '申请备注',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请借款时间',
  `repay_amount` decimal(8,2) DEFAULT '0.00' COMMENT '还款金额',
  `repay_type` char(30) DEFAULT '' COMMENT '还款方式,从常参数中调用',
  `repay_need_time` timestamp NULL DEFAULT NULL COMMENT '要求还款时间',
  `repay_real_time` timestamp NULL DEFAULT NULL COMMENT '实际还款时间',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_remark` varchar(500) DEFAULT '' COMMENT '审核备注',
  `check_time` char(30) DEFAULT '' COMMENT '审核时间',
  `payment_user_id` int(11) DEFAULT '0' COMMENT '付款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '付款姓名',
  `payment_name` char(30) DEFAULT '' COMMENT '付款方式,从常参数中调用',
  `payment_time` char(30) DEFAULT '' COMMENT '付款时间',
  `status` tinyint(1) DEFAULT '0' COMMENT '-1:删除,0:等待审核,1:等待付款,2:等待还款,3:已完成',
  PRIMARY KEY (`borrow_id`),
  KEY `repay_type` (`repay_type`),
  KEY `payment_type` (`payment_name`),
  KEY `status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COMMENT='借款表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_expense_general`
--

DROP TABLE IF EXISTS `erp_financial_expense_general`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_expense_general` (
  `expense_general_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_materials_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单物料ID',
  `expense_project` char(100) DEFAULT '' COMMENT '报销项目',
  `expense_amount` decimal(10,2) DEFAULT '0.00' COMMENT '报销金额',
  `expense_user_id` int(11) DEFAULT '0' COMMENT '报销人ID',
  `expense_user_name` char(30) DEFAULT '' COMMENT '报销人姓名',
  `expense_payee` char(30) DEFAULT '' COMMENT '领款人姓名',
  `expense_remark` varchar(500) DEFAULT '' COMMENT '报销备注',
  `branch_id` int(8) DEFAULT '0' COMMENT '部门ID',
  `branch_name` char(100) DEFAULT '' COMMENT '部门名称',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_time` char(30) DEFAULT '' COMMENT '审核时间',
  `check_remark` varchar(500) DEFAULT '' COMMENT '审核备注',
  `payment_user_id` int(11) DEFAULT '0' COMMENT '付款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '付款姓名',
  `payment_time` char(30) DEFAULT '' COMMENT '付款时间',
  `payment_name` char(30) DEFAULT '' COMMENT '付款方式',
  `status` tinyint(1) DEFAULT '0' COMMENT '-1:删除,0:等待审核,1:等待付款,2:驳回,3:已付款',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_general_id`),
  KEY `order_materials_id` (`order_materials_id`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8 COMMENT='财务报销申请表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_expense_purchase`
--

DROP TABLE IF EXISTS `erp_financial_expense_purchase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_expense_purchase` (
  `expense_purchase_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_purchase_id` int(11) DEFAULT '0',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `purchase_no` char(30) DEFAULT '' COMMENT '采购号',
  `purchase_price` decimal(8,2) DEFAULT '0.00' COMMENT '采购单价',
  `purchase_expect_count` float DEFAULT '0' COMMENT '应采购数量',
  `purchase_actual_count` float DEFAULT '0' COMMENT '实际采购数量',
  `purchase_actual_amount` decimal(8,2) DEFAULT '0.00' COMMENT '采购总额=采购单价*实采购数',
  `purchase_bill_image` char(150) DEFAULT '' COMMENT '采购单图片',
  `purchase_full_price` decimal(8,2) DEFAULT '0.00' COMMENT '采购足米单价',
  `purchase_diff` float DEFAULT '0' COMMENT '空差',
  `purchase_paper` float DEFAULT '0' COMMENT '纸筒',
  `actual_num` int(5) DEFAULT '0',
  `actual_amount` decimal(8,2) DEFAULT '0.00' COMMENT '实裁报销金额=实裁件数*客户单价',
  `supplier_id` int(8) DEFAULT '0' COMMENT '供应商ID',
  `supplier_name` char(150) DEFAULT '' COMMENT '供应商名称',
  `sku_no` char(30) DEFAULT '',
  `sku_image` char(150) DEFAULT '',
  `materials_id` int(11) DEFAULT '0',
  `materials_name` char(150) DEFAULT '',
  `materials_category` char(30) DEFAULT '' COMMENT '物料类型',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT 'SKU物料单价',
  `materials_price` decimal(8,2) DEFAULT '0.00' COMMENT '批次物料单价',
  `materials_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户金额',
  `formula_amount` decimal(8,2) DEFAULT '0.00' COMMENT '公式金额',
  `expense_amount` decimal(8,2) DEFAULT '0.00' COMMENT '报销金额',
  `expense_date` char(30) DEFAULT '' COMMENT '报销单日期',
  `expense_way` char(30) DEFAULT '' COMMENT '报销方式,从常用参数调用',
  `expense_user_id` int(11) DEFAULT '0' COMMENT '报销人ID',
  `expense_user_name` char(30) DEFAULT '' COMMENT '报销人姓名',
  `expense_payee` char(30) DEFAULT '' COMMENT '领款人',
  `expense_remark` varchar(500) DEFAULT '' COMMENT '报销备注',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_time` char(30) DEFAULT '' COMMENT '审核时间',
  `check_remark` varchar(500) DEFAULT '' COMMENT '审核备注',
  `payment_user_id` int(11) DEFAULT '0' COMMENT '付款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '付款人姓名',
  `payment_time` char(30) DEFAULT '' COMMENT '付款时间',
  `payment_name` char(30) DEFAULT '' COMMENT '支付款方式',
  `apply_times` tinyint(1) DEFAULT '1' COMMENT '申请次数',
  `expense_status` tinyint(1) DEFAULT '0' COMMENT '-1:删除,0:等待审核,1:等待付款,2:驳回,3:付款完成',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_purchase_id`)
) ENGINE=InnoDB AUTO_INCREMENT=819 DEFAULT CHARSET=utf8 COMMENT='采购报销表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_fine`
--

DROP TABLE IF EXISTS `erp_financial_fine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_fine` (
  `fine_id` int(11) NOT NULL AUTO_INCREMENT,
  `fine_amount` decimal(8,2) DEFAULT '0.00' COMMENT '罚款金额',
  `fine_reason` char(100) DEFAULT '' COMMENT '罚款事由',
  `fine_type` char(30) DEFAULT '' COMMENT '罚款方式,从常参数中调用',
  `fined_user_name` char(30) DEFAULT '' COMMENT '被罚款人姓名',
  `opt_remark` varchar(500) DEFAULT '' COMMENT '罚款备注',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '罚款人ID，申请人',
  `opt_user_name` char(30) DEFAULT '' COMMENT '罚款人姓名，申请人',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '罚款时间',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_remark` varchar(500) DEFAULT NULL COMMENT '审核备注',
  `check_time` char(30) DEFAULT '' COMMENT '审核时间',
  `status` tinyint(1) DEFAULT '0' COMMENT '-1:删除,0:等待审核,1:已完成',
  PRIMARY KEY (`fine_id`),
  KEY `payment_type` (`fine_type`),
  KEY `status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=5571 DEFAULT CHARSET=utf8 COMMENT='罚款表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_outgo`
--

DROP TABLE IF EXISTS `erp_financial_outgo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_outgo` (
  `financial_outgo_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0',
  `order_no` char(50) NOT NULL DEFAULT '' COMMENT '订单编号|批次号',
  `order_type` enum('FOB','CMT','ODM','新CMT') NOT NULL DEFAULT 'FOB' COMMENT '订单类型',
  `order_price` decimal(8,2) DEFAULT '0.00' COMMENT '订单单价|客户单价',
  `order_num` int(5) NOT NULL DEFAULT '0' COMMENT '下单件数',
  `order_code` char(200) NOT NULL DEFAULT '[]' COMMENT '订单码数，格式 [s:10,M,20]',
  `order_delivery_date` date DEFAULT NULL COMMENT '目标交付日期|客户交期',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '客户下单时间',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(50) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `sku_type` enum('女装','男装','童装') DEFAULT NULL COMMENT '服装类型',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型',
  `repertory_num` int(5) NOT NULL DEFAULT '0' COMMENT '库存件数',
  `repertory_code` char(150) NOT NULL DEFAULT '' COMMENT '库存码数',
  `production_price` decimal(8,2) DEFAULT '0.00' COMMENT '生产单价|外发单价',
  `production_amount` decimal(8,2) DEFAULT '0.00' COMMENT '生产总额|应付金额',
  `production_num` int(5) NOT NULL DEFAULT '0' COMMENT '生产件数=下单件数-库存件数',
  `production_code` char(150) NOT NULL DEFAULT '' COMMENT '生产码数=订单码数-库存码数',
  `single_num` int(5) NOT NULL DEFAULT '0' COMMENT '客户单耗件数=主面料采购米数/客户单耗',
  `expect_num` int(5) NOT NULL DEFAULT '0' COMMENT '预裁件数=打卷米数/预裁单耗',
  `actual_num` int(5) NOT NULL DEFAULT '0' COMMENT '实裁件数(填写)',
  `actual_code` char(150) NOT NULL DEFAULT '' COMMENT '实裁码数，格式 [S:10,M,20]',
  `producer_id` int(8) NOT NULL DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) NOT NULL DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `surplus_repertory_code` char(150) DEFAULT '{}' COMMENT '尾部剩余件数|正品库存件数',
  `defective_num` int(3) DEFAULT '0' COMMENT '次品件数',
  `delivery_num` int(5) NOT NULL DEFAULT '0' COMMENT '客户收货数',
  `delivery_code` char(150) NOT NULL DEFAULT '{}' COMMENT '客户收货码数，格式 [S:10,M,20]',
  `delivery_time` timestamp NULL DEFAULT NULL COMMENT '客户收货时间',
  `deduct_amount` decimal(8,2) DEFAULT '0.00' COMMENT '扣款金额',
  `filling_amount` decimal(8,2) DEFAULT '0.00' COMMENT '补款金额',
  `check_user_id` int(8) NOT NULL DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) NOT NULL DEFAULT '' COMMENT '审核人姓名',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `check_remark` varchar(500) DEFAULT NULL COMMENT '审核备注',
  `payment_amount` decimal(8,2) DEFAULT '0.00' COMMENT '结款金额',
  `payment_user_id` int(8) DEFAULT '0' COMMENT '结款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '结款人姓名',
  `payment_name` char(30) DEFAULT '' COMMENT '结款方式',
  `payment_time` timestamp NULL DEFAULT NULL COMMENT '结款时间',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0:等待审核，1:等待付款，2:付款完成',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  PRIMARY KEY (`financial_outgo_id`),
  KEY `inx_orderNo` (`order_no`,`sku_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='外发厂账单表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_process`
--

DROP TABLE IF EXISTS `erp_financial_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_process` (
  `financial_process_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `order_id` int(11) DEFAULT '0',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `order_num` int(5) DEFAULT '0' COMMENT '订单数量',
  `expect_num` int(5) DEFAULT '0' COMMENT '预裁件数=打卷米数/预裁单耗',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数',
  `sku_id` int(8) DEFAULT '0',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `materials_id` int(11) DEFAULT '0',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称。选填',
  `process_name` char(50) DEFAULT '' COMMENT '工艺名称，从常用参数中选择',
  `process_class` enum('裁前','裁后','成衣') DEFAULT '成衣' COMMENT '工艺归类',
  `supplier_id` int(8) DEFAULT '0' COMMENT '供应商ID',
  `supplier_name` char(50) DEFAULT '' COMMENT '供应商名称',
  `process_price` decimal(8,2) DEFAULT '0.00' COMMENT '工艺单价|客户单价',
  `process_remark` varchar(250) DEFAULT '' COMMENT '工艺备注',
  `process_amount` decimal(8,2) DEFAULT '0.00' COMMENT '艺厂总价',
  `factory_price` decimal(8,2) DEFAULT '0.00' COMMENT '本厂单价=工艺厂总价/实裁件数',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT '工艺厂单价',
  `producer_id` int(8) DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(50) DEFAULT '' COMMENT '生产方名称',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `pyament_amount` decimal(8,2) DEFAULT '0.00' COMMENT '付款金额=实裁件数*本厂单价',
  `payment_type` char(30) DEFAULT '' COMMENT '付款方式,从常参数中调用',
  `payment_user_id` int(8) DEFAULT '0' COMMENT '付款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '付款人姓名',
  `payment_time` timestamp NULL DEFAULT NULL COMMENT '付款时间',
  `process_status` tinyint(1) DEFAULT '0' COMMENT '0:等待审核，1、等待付款，2、完成',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`financial_process_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='工艺费用审核付款表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_project`
--

DROP TABLE IF EXISTS `erp_financial_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_project` (
  `project_id` int(5) NOT NULL AUTO_INCREMENT,
  `type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1补款2扣款',
  `project_name` char(30) NOT NULL DEFAULT '' COMMENT '项目名称',
  `sort` int(5) NOT NULL DEFAULT '0' COMMENT '排序权重',
  PRIMARY KEY (`project_id`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8 COMMENT='财务项目表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_financial_work`
--

DROP TABLE IF EXISTS `erp_financial_work`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_financial_work` (
  `financial_work_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0',
  `order_no` char(50) NOT NULL DEFAULT '' COMMENT '订单编号|批次号',
  `order_type` enum('FOB','CMT','ODM','新CMT') NOT NULL DEFAULT 'FOB' COMMENT '订单类型',
  `order_price` decimal(8,2) DEFAULT '0.00' COMMENT '订单单价|客户单价',
  `order_num` int(5) NOT NULL DEFAULT '0' COMMENT '下单件数',
  `order_delivery_date` date DEFAULT NULL COMMENT '目标交付日期|客户交期',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '客户下单时间',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(50) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `sku_type` enum('女装','男装','童装') DEFAULT NULL COMMENT '服装类型',
  `materials_id` int(11) DEFAULT '0' COMMENT '物料ID',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称',
  `single_num` int(5) NOT NULL DEFAULT '0' COMMENT '客户单耗件数=主面料采购米数/客户单耗',
  `expect_num` int(5) NOT NULL DEFAULT '0' COMMENT '预裁件数=打卷米数/预裁单耗',
  `actual_num` int(5) NOT NULL DEFAULT '0' COMMENT '实裁件数(填写)',
  `producer_id` int(8) NOT NULL DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) NOT NULL DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `surplus_repertory_num` char(3) DEFAULT '0' COMMENT '正品库存件数',
  `defective_num` int(3) DEFAULT '0' COMMENT '次品件数',
  `delivery_num` int(5) NOT NULL DEFAULT '0' COMMENT '客户收货数',
  `delivery_time` timestamp NULL DEFAULT NULL COMMENT '客户收货时间',
  `user_id` int(8) DEFAULT '0' COMMENT '员工ID',
  `user_name` char(30) DEFAULT '' COMMENT '员工姓名',
  `production_class` char(30) DEFAULT NULL COMMENT '部门：''裁床'',''车缝'',''尾部''',
  `work_type` char(30) DEFAULT '' COMMENT '工种',
  `work_num` int(5) DEFAULT '0' COMMENT '加工数量',
  `work_price` decimal(8,2) DEFAULT '0.00' COMMENT '加工单价',
  `work_amount` decimal(8,2) DEFAULT '0.00' COMMENT '加工金额=加工数量*加工单价',
  `check_user_id` int(8) NOT NULL DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) NOT NULL DEFAULT '' COMMENT '审核人姓名',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `check_remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `payment_amount` decimal(8,2) DEFAULT '0.00' COMMENT '结款金额',
  `payment_user_id` int(8) DEFAULT '0' COMMENT '结款人ID',
  `payment_user_name` char(30) DEFAULT '' COMMENT '结款人姓名',
  `payment_name` char(30) DEFAULT '' COMMENT '结款方式',
  `payment_time` timestamp NULL DEFAULT NULL COMMENT '结款时间',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0:等待审核，1:等待付款，2:付款完成',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  PRIMARY KEY (`financial_work_id`),
  KEY `inx_orderNo` (`order_no`,`sku_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='生产工资表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_fn_order_log`
--

DROP TABLE IF EXISTS `erp_fn_order_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_fn_order_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` char(1) DEFAULT NULL COMMENT '订单号',
  `result` mediumtext,
  `updatetime` int(11) DEFAULT NULL COMMENT '更新时间',
  `createtime` int(11) DEFAULT NULL COMMENT '添加时间',
  `status` tinyint(1) DEFAULT '0' COMMENT '执行状态',
  `content` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_menu`
--

DROP TABLE IF EXISTS `erp_menu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_menu` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '文档ID',
  `type` tinyint(1) DEFAULT '1' COMMENT '菜单类型1，菜单 2按钮',
  `title` varchar(50) NOT NULL DEFAULT '' COMMENT '标题',
  `pid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '上级分类ID',
  `sort` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '排序（同级有效）',
  `icon` varchar(100) NOT NULL DEFAULT '' COMMENT '菜单图标',
  `url` char(255) NOT NULL DEFAULT '' COMMENT '链接地址',
  `hide` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '是否隐藏',
  `tip` varchar(255) NOT NULL DEFAULT '' COMMENT '提示',
  `group` varchar(50) DEFAULT '' COMMENT '分组',
  `is_dev` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '是否仅开发者模式可见',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UNIQUE` (`url`)
) ENGINE=MyISAM AUTO_INCREMENT=347 DEFAULT CHARSET=utf8 COMMENT='栏目表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_mes_cutting`
--

DROP TABLE IF EXISTS `erp_mes_cutting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_mes_cutting` (
  `mes_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` char(20) NOT NULL DEFAULT '',
  `content` text,
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0未执行 1已执行',
  `order_time` timestamp NULL DEFAULT NULL,
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `code` text COMMENT '裁床数',
  PRIMARY KEY (`mes_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4493 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_mes_history`
--

DROP TABLE IF EXISTS `erp_mes_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_mes_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_num` int(3) DEFAULT '0' COMMENT '返回数据数量',
  `fail_num` int(3) DEFAULT '0' COMMENT '失败数量',
  `start_time` timestamp NULL DEFAULT NULL COMMENT '开始时间',
  `end_time` timestamp NULL DEFAULT NULL COMMENT '结束时间',
  `remark` varchar(200) DEFAULT '' COMMENT '备注',
  `status` tinyint(1) DEFAULT '1' COMMENT '0:请求失败，1：请求成功',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `add_time` (`add_time`)
) ENGINE=InnoDB AUTO_INCREMENT=127179 DEFAULT CHARSET=utf8 COMMENT='MES接口请求记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_mes_order`
--

DROP TABLE IF EXISTS `erp_mes_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_mes_order` (
  `order_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_no` char(30) NOT NULL DEFAULT '' COMMENT '订单编号',
  `order_type` char(30) DEFAULT '' COMMENT '订单类型',
  `sku_no` char(50) DEFAULT '' COMMENT 'SKU',
  `sku_image` char(150) DEFAULT '',
  `ref_sku` char(30) DEFAULT '' COMMENT '参数SKU',
  `design_no` char(50) DEFAULT '' COMMENT '设计号',
  `api_flag` tinyint(1) DEFAULT '1' COMMENT '这个字段丢弃',
  `weaving_type` char(30) DEFAULT '' COMMENT '编织类型',
  `order_first_flag` tinyint(1) DEFAULT '0' COMMENT '首单标识',
  `order_exigence_flag` tinyint(1) DEFAULT '0' COMMENT '紧急标识',
  `order_stocked_type` char(30) DEFAULT '' COMMENT '备货类型',
  `order_code` char(100) DEFAULT '[]' COMMENT '订单码数',
  `order_num` int(5) DEFAULT '0' COMMENT '订单数量',
  `order_delivery_date` date DEFAULT NULL COMMENT '目标交期',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '下单时间',
  `accept_time` timestamp NULL DEFAULT NULL COMMENT '接单时间',
  `cost_detail` text COMMENT '费用详情',
  `materials_purchase` text COMMENT '采购物料',
  `materials_pick` text COMMENT '领取物料',
  `second_process` text COMMENT '二次工艺',
  `sku_flag` tinyint(1) DEFAULT '0' COMMENT '导入SKU：0、等待处理，1、已处理',
  `order_flag` tinyint(1) DEFAULT '0' COMMENT '导入订单：0、等待处理，1、已处理，-1，sku呆完善',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `customer_id` int(11) DEFAULT '0' COMMENT '客户来源（按接口划分）',
  `customer_name` char(50) DEFAULT '',
  `is_exe` tinyint(1) DEFAULT '0' COMMENT '是否执行',
  PRIMARY KEY (`order_id`),
  KEY `sku_no` (`sku_no`),
  KEY `order_no` (`order_no`)
) ENGINE=InnoDB AUTO_INCREMENT=10503 DEFAULT CHARSET=utf8 COMMENT='MES接口订单信息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_mes_tail`
--

DROP TABLE IF EXISTS `erp_mes_tail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_mes_tail` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` char(20) NOT NULL DEFAULT '' COMMENT '订单号',
  `content` text COMMENT '订单内容',
  `add_time` timestamp NULL DEFAULT NULL,
  `status` tinyint(1) DEFAULT '0' COMMENT '0未获取详情1获取详情',
  `content_detail` text COMMENT '订单发货内容',
  `deliver_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '发货单号',
  `delivery_time` timestamp NULL DEFAULT NULL COMMENT '发货日期',
  `delivery_type` tinyint(1) DEFAULT '1' COMMENT '1:jit',
  PRIMARY KEY (`id`),
  UNIQUE KEY `deliverId` (`deliver_id`),
  KEY `order_no` (`order_no`)
) ENGINE=InnoDB AUTO_INCREMENT=10685 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_operate_log`
--

DROP TABLE IF EXISTS `erp_operate_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_operate_log` (
  `operate_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `operate_type` tinyint(2) unsigned NOT NULL COMMENT '日志类型',
  `union_id` int(11) NOT NULL COMMENT '关联的日志记录 1 采购记录 2 入仓出仓记录 3裁床记录 4车缝记录 5尾部记录',
  `content` varchar(1000) NOT NULL DEFAULT '' COMMENT '记录信息',
  `user_id` int(11) NOT NULL COMMENT '操作人',
  `user_name` varchar(10) NOT NULL DEFAULT '',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`operate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order`
--

DROP TABLE IF EXISTS `erp_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order` (
  `order_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` char(50) NOT NULL DEFAULT '' COMMENT '订单编号|批次号',
  `design_no` char(50) NOT NULL DEFAULT '' COMMENT '设计款号',
  `order_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '状态，参考订单状态表',
  `api_flag` tinyint(1) DEFAULT '0' COMMENT '1、美景，2、传承，3、美丽',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(50) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_extra` char(50) NOT NULL DEFAULT '' COMMENT '参考sku',
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `sku_type` char(20) DEFAULT '' COMMENT '服装类型',
  `sku_code` text COMMENT '尺码价格',
  `difficulty_level` char(30) DEFAULT '' COMMENT '难易度',
  `order_type` char(20) NOT NULL DEFAULT '' COMMENT '订单类型',
  `order_num` int(5) NOT NULL DEFAULT '0' COMMENT '下单件数',
  `order_code` text NOT NULL COMMENT '订单码数，格式 [s:10,M,20]',
  `order_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '订单单价',
  `order_total_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '订单总价=订单单价*订单数量',
  `order_stocked_type` char(50) NOT NULL DEFAULT '' COMMENT '备货类型',
  `order_first_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1、首单标识，0、返单标识',
  `order_exigence_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1、紧急标识，0、普通标识',
  `order_over_flag` tinyint(1) DEFAULT '0' COMMENT '1、订单节点超时',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `expect_delivery_date` date DEFAULT NULL COMMENT '预计交期',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '客户下单时间',
  `order_hours` char(10) NOT NULL DEFAULT '' COMMENT '批次工时=SKU工时*下单件数',
  `weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型',
  `repertory_num` int(5) NOT NULL DEFAULT '0' COMMENT '库存件数',
  `repertory_code` varchar(2000) NOT NULL DEFAULT '' COMMENT '库存码数',
  `production_num` int(5) NOT NULL DEFAULT '0' COMMENT '生产件数=下单件数-库存件数',
  `production_code` varchar(2000) NOT NULL DEFAULT '' COMMENT '生产码数=订单码数-库存码数',
  `single_num` int(5) NOT NULL DEFAULT '0' COMMENT '客户单耗件数=主面料采购米数/客户单耗',
  `expect_num` int(5) NOT NULL DEFAULT '0' COMMENT '预裁件数=打卷米数/预裁单耗',
  `process_str` char(150) NOT NULL DEFAULT '' COMMENT '工艺项目，多项目用中文顿号"、"隔开',
  `cutting_price` decimal(8,2) DEFAULT '0.00' COMMENT '裁床单价',
  `sewing_price` decimal(8,2) DEFAULT '0.00' COMMENT '车缝单价',
  `tail_price` decimal(8,2) DEFAULT '0.00' COMMENT '尾部单价',
  `check_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) NOT NULL DEFAULT '' COMMENT '审核人姓名',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `producer_id` int(8) NOT NULL DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) NOT NULL DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `producer_branch_id_1` int(5) DEFAULT '0' COMMENT '生产方一级部门ID',
  `split_user_id` int(8) NOT NULL DEFAULT '0' COMMENT '分单操作人ID',
  `split_user_name` char(30) NOT NULL DEFAULT '' COMMENT '分单操作人姓名',
  `split_need_time` timestamp NULL DEFAULT NULL COMMENT '要求分单时间',
  `split_real_time` timestamp NULL DEFAULT NULL COMMENT '实际分单时间',
  `split_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '分单状态：0、等待分单；1、分单完成',
  `schedule_str` text COMMENT '订单时效数据（JSON）,审单后产生，如{"KEY12_4":{"title":"入仓完成","items":[{"name":"名称","need_time":"00:00:00","real_time":"00:00:00"}]}}',
  `schedule_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '变更时效操作员ID',
  `schedule_user_name` char(30) NOT NULL DEFAULT '' COMMENT '变更时效操作员姓名',
  `schedule_remark` varchar(250) NOT NULL DEFAULT '' COMMENT '变更备注',
  `schedule_time` timestamp NULL DEFAULT NULL COMMENT '变更时效时间',
  `overtime_part` char(150) NOT NULL DEFAULT '' COMMENT '超时环节/超时模块，如果：KEY12_4,KEY12_3',
  `order_remark` varchar(1000) DEFAULT '' COMMENT '备注',
  `order_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '添加操作员ID',
  `order_user_name` char(30) NOT NULL DEFAULT '' COMMENT '添加操作员姓名',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `customer_id` int(11) NOT NULL DEFAULT '0' COMMENT '客户id',
  `customer_name` char(150) NOT NULL DEFAULT '' COMMENT '客户名称',
  `customer_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '客户利润预提后总价（订单价格减去利润预取）',
  `profit_scale` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '客户利润预提比例',
  `subtract_day` char(50) DEFAULT '' COMMENT '工厂交期减天数',
  `message_count` int(10) NOT NULL DEFAULT '0' COMMENT '留言板备注次数',
  `shipment_no` char(100) NOT NULL DEFAULT '' COMMENT '发货号',
  `sku_color_code` varchar(500) DEFAULT '' COMMENT 'sku颜色',
  `sku_size_code` varchar(500) DEFAULT '' COMMENT 'sku尺码',
  `branch_id_1` int(11) DEFAULT '0' COMMENT '分单工厂（生产方）',
  `branch_name_1` char(50) DEFAULT '' COMMENT '分单工厂名称',
  `before_require` char(150) DEFAULT '' COMMENT '裁前要求',
  `cutting_require` char(150) DEFAULT '' COMMENT '裁床要求',
  `sewing_require` char(150) DEFAULT '' COMMENT '车缝要求',
  `tail_require` char(150) DEFAULT '' COMMENT '尾部要求',
  `tail_waistband_flag` int(1) DEFAULT '0' COMMENT '1、有腰带',
  `tail_waistline_flag` int(1) DEFAULT '0' COMMENT '1、需订腰绳',
  `tail_button_flag` int(1) DEFAULT '0' COMMENT '1、需备用扣',
  `plan_branch_id_2` int(11) DEFAULT '0' COMMENT '计划生产部门',
  `plan_branch_name_2` char(50) DEFAULT '' COMMENT '计划生产部门',
  `plan_branch_id_3` int(11) DEFAULT '0' COMMENT '计划生产部门',
  `plan_branch_name_3` char(50) DEFAULT '' COMMENT '计划生产部门',
  `sku_production_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '客户加工费（车缝加工费）',
  `production_duty` varchar(500) NOT NULL DEFAULT '' COMMENT '生产责任划分',
  `process_cost` decimal(8,2) DEFAULT '0.00' COMMENT '加工费（成本核算）',
  `is_run` tinyint(1) DEFAULT '0' COMMENT '是否运行',
  `account_check` tinyint(1) NOT NULL DEFAULT '0' COMMENT '外发厂账单审核 0等待审核1已审核，未结算2已结算',
  `account_check_id` int(11) DEFAULT '0' COMMENT '外发厂账单审核人',
  `account_check_time` timestamp NULL DEFAULT NULL COMMENT '外发厂账单审核时间',
  `profit` decimal(8,2) DEFAULT '0.00' COMMENT '预提利润',
  `factory_price` decimal(8,2) DEFAULT '0.00' COMMENT '工厂加工费',
  `system_status` tinyint(1) DEFAULT '0' COMMENT '系统执行状态',
  `grade_name` char(10) NOT NULL DEFAULT '' COMMENT '加工厂级别',
  `split_type` char(5) DEFAULT 'CMT' COMMENT '分单类型 CMT,FOB',
  `factory_id` int(11) NOT NULL DEFAULT '0' COMMENT '加工厂',
  `factory_proportion` decimal(8,2) DEFAULT '0.00' COMMENT '加工比例',
  `factory_bill_id` int(11) NOT NULL DEFAULT '0' COMMENT '外发厂账单id',
  `settle_id` int(11) DEFAULT NULL COMMENT '结算人',
  `settle_time` timestamp NULL DEFAULT NULL COMMENT '结算时间',
  `factory_remark` text,
  `sell_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '销售价',
  `process_desc` text COMMENT '工艺内容',
  `track_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '跟单员',
  `track_phone` char(20) NOT NULL COMMENT '跟单电话',
  `sample_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '车板员',
  `sample_time` timestamp NULL DEFAULT NULL COMMENT '打板时间',
  `sample_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '样板状态:0=待审单,1=待分单,2=打样中,3已完成',
  `sample_opt_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '打板操作人',
  `sample_complete_status` tinyint(1) DEFAULT '0' COMMENT '打板完成状态',
  `sample_complete_time` timestamp NULL DEFAULT NULL COMMENT '打板完成时间',
  `patten_type` char(10) DEFAULT '' COMMENT '1头版2修改版3产前版',
  `is_exe` tinyint(1) DEFAULT '0' COMMENT '任务是否执行',
  `is_sample` tinyint(1) DEFAULT '0' COMMENT '是否样板单',
  `freight` float(10,2) DEFAULT '0.00' COMMENT '运费',
  `freight_des` varchar(150) DEFAULT NULL COMMENT '运费描述',
  `other_cost` float(10,2) DEFAULT NULL COMMENT '其他费用',
  `other_cost_des` varchar(150) DEFAULT NULL COMMENT '其他费用描述',
  `outsource_date` date DEFAULT NULL COMMENT '外发货期',
  `shipment_time` timestamp NULL DEFAULT NULL COMMENT '尾部出货时间',
  `pattern_user_id` int(11) DEFAULT NULL COMMENT '纸样师',
  `add_amount` decimal(8,2) DEFAULT NULL COMMENT '补款金额',
  `sub_amount` decimal(8,2) DEFAULT NULL COMMENT '扣款金额',
  `add_remark` text,
  `sub_remark` text,
  `add_sub_user` int(10) DEFAULT NULL COMMENT '扣补款人',
  `time_limit` tinyint(1) DEFAULT '0' COMMENT '0=未超期,1已超期',
  `sample_remark` text COMMENT '样板单备注',
  `rate_way` tinyint(1) DEFAULT '1' COMMENT '分厂合作倍率方式',
  `submit_user_id` int(10) DEFAULT NULL COMMENT '提交人',
  `submit_status` tinyint(10) DEFAULT '1' COMMENT '提交状态',
  `submit_time` timestamp NULL DEFAULT NULL,
  `course_con_imgs` text,
  `processing_type` tinyint(1) DEFAULT '0' COMMENT '0=无,1=成品,2=定制',
  `xm_order_no` varchar(200) DEFAULT '' COMMENT '小满单号',
  `order_proportion` decimal(10,4) DEFAULT NULL COMMENT '订单倍率，NULL则用SKU的',
  `order_delivery_date` date DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `order_no` (`order_no`),
  KEY `inx_orderNo` (`sku_no`,`design_no`),
  KEY `plan_branch_id_2` (`plan_branch_id_2`),
  KEY `plan_branch_id_3` (`plan_branch_id_3`),
  KEY `branch_id_1` (`branch_id_1`),
  KEY `customer_id` (`customer_id`),
  KEY `order_status` (`order_status`)
) ENGINE=InnoDB AUTO_INCREMENT=25185 DEFAULT CHARSET=utf8 COMMENT='数据源';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_abnormal`
--

DROP TABLE IF EXISTS `erp_order_abnormal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_abnormal` (
  `abnormal_id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(8) DEFAULT '0' COMMENT '异常项目ID(从常用项目从获取)',
  `project_name` char(30) DEFAULT '' COMMENT '异常项目名称',
  `sys_param` char(30) DEFAULT '' COMMENT '系统异常参数，如：KEY01_01',
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `order_type` enum('FOB','CMT','ODM','新CMT') DEFAULT NULL COMMENT '订单类型',
  `sku_no` char(8) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `order_materials_id` int(11) DEFAULT '0' COMMENT '订单物料ID',
  `materials_id` int(11) DEFAULT '0' COMMENT 'SKU物料ID',
  `materials_name` char(30) DEFAULT '' COMMENT '物料名称',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_category` enum('主面料','面料','里布','衬布','辅料') DEFAULT NULL,
  `purchase_bar` char(20) DEFAULT '' COMMENT '采购条数',
  `submit_user_id` int(11) DEFAULT '0' COMMENT '提交人ID',
  `submit_user_name` char(30) DEFAULT '' COMMENT '提交人姓名',
  `submit_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `abnormal_reason` varchar(500) DEFAULT '' COMMENT '异常原因',
  `abnormal_remark` varchar(500) DEFAULT '' COMMENT '异常备注',
  `abnormal_status` tinyint(1) DEFAULT '0' COMMENT '0：待处理，1：已处理',
  `check_user_id` int(11) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_remark` varchar(500) DEFAULT '' COMMENT '审核备注',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `branch_id` int(8) DEFAULT '0' COMMENT '部门ID',
  `branch_id_2` int(8) DEFAULT '0' COMMENT '二级部门ID',
  `branch_name` char(100) DEFAULT '' COMMENT '部门名称',
  `producer_id` int(8) DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) DEFAULT '' COMMENT '生产方名称',
  `pricing_need_amount` decimal(8,2) DEFAULT '0.00' COMMENT '需要调价金额',
  `pricing_actual_amount` decimal(8,2) DEFAULT '0.00' COMMENT '实际调价金额',
  `pricing_reason` varchar(250) DEFAULT '' COMMENT '调价原因',
  `pricing_remark` varchar(250) DEFAULT '' COMMENT '调价备注',
  `pricing_status` tinyint(1) DEFAULT '0' COMMENT '调价状态：-1：无需调价，0、等待调价，1、调价成功，2、调价失败',
  PRIMARY KEY (`abnormal_id`),
  KEY `order_id` (`order_id`,`order_materials_id`),
  KEY `order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='订单异常表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_cost`
--

DROP TABLE IF EXISTS `erp_order_cost`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_cost` (
  `order_cost_id` int(11) NOT NULL AUTO_INCREMENT,
  `cost_id` int(11) DEFAULT '0',
  `sku_id` int(11) DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `producer_id` int(8) DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) DEFAULT '' COMMENT '生产方名称',
  `cost_class` varchar(255) DEFAULT NULL,
  `cost_name` char(50) DEFAULT '' COMMENT '成本名称，从常用参数中选择',
  `cost_unit` char(10) DEFAULT '' COMMENT '成本单位',
  `cost_price` decimal(8,2) DEFAULT '0.00' COMMENT '成本单价',
  `cost_amount` decimal(8,2) DEFAULT '0.00' COMMENT '成本金额=成本单价*实裁件数',
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `order_num` int(5) NOT NULL DEFAULT '0' COMMENT '订单数量|客户下单数',
  `expect_num` int(5) DEFAULT '0' COMMENT '预裁件数',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数',
  PRIMARY KEY (`order_cost_id`),
  KEY `sku_id` (`sku_id`),
  KEY `sku_no` (`sku_no`),
  KEY `opt_user_id` (`order_id`),
  KEY `cost_class` (`cost_class`),
  KEY `cost_name` (`cost_name`),
  KEY `order_id` (`order_id`),
  KEY `order_no` (`order_no`)
) ENGINE=InnoDB AUTO_INCREMENT=176 DEFAULT CHARSET=utf8 COMMENT='订单成本费用表\r\n(手工、专机、利润)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_history`
--

DROP TABLE IF EXISTS `erp_order_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_history` (
  `history_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单id',
  `opt_log` text COMMENT '操作日志',
  `opt_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '用户id',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '操作时间',
  `opt_type` varchar(255) DEFAULT NULL COMMENT '操作类型',
  PRIMARY KEY (`history_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9266 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials`
--

DROP TABLE IF EXISTS `erp_order_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials` (
  `order_id` int(11) NOT NULL COMMENT '订单id',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `order_materials_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_num` int(5) DEFAULT '0' COMMENT '下单件数',
  `order_type` char(0) DEFAULT NULL COMMENT '订单类型',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '下单时间',
  `order_first_flag` tinyint(1) DEFAULT '0' COMMENT '1、首单标识',
  `order_exigence_flag` tinyint(1) DEFAULT '0' COMMENT '1、紧急标识',
  `order_stocked_type` char(30) DEFAULT '' COMMENT '备货类型',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂目标日期',
  `production_num` int(5) DEFAULT '0' COMMENT '生产件数',
  `sku_id` int(11) DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(50) DEFAULT '' COMMENT 'SKU编号',
  `sku_color` char(50) DEFAULT '' COMMENT 'sku颜色组中的一个',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `supplier_id` int(11) NOT NULL DEFAULT '0' COMMENT '供应商ID',
  `supplier_name` char(50) DEFAULT '' COMMENT '供应商名称',
  `materials_id` int(11) DEFAULT '0' COMMENT '物料ID',
  `materials_no` char(30) DEFAULT '' COMMENT '物料编号',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_unit` char(20) DEFAULT '' COMMENT '单位',
  `materials_category` enum('主面料','面料','里布','衬布','辅料','夹棉') DEFAULT '辅料' COMMENT '物料类型',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT '客户单价',
  `materials_price` decimal(8,2) DEFAULT '0.00' COMMENT '物料单价=客户单价*单件用量',
  `materials_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户总额=物料单价*下单件数',
  `materials_single` float DEFAULT '0' COMMENT '单件用量',
  `materials_weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型(面料)',
  `materials_color` char(20) DEFAULT '' COMMENT '物料颜色',
  `materials_kg` char(10) DEFAULT '' COMMENT '克重g/m2',
  `materials_cm` char(10) DEFAULT '' COMMENT '幅宽(cm)',
  `materials_kilo` char(30) DEFAULT '' COMMENT '公斤数',
  `materials_loss` char(20) DEFAULT '' COMMENT '物料损耗',
  `process_str` char(150) DEFAULT '' COMMENT '二次工艺',
  `purchase_no` char(50) DEFAULT '' COMMENT '采购单号',
  `purchase_times` tinyint(1) DEFAULT '0' COMMENT '采购次数',
  `pick_flag` tinyint(1) DEFAULT '0' COMMENT '1、MES领料标识',
  `status` tinyint(1) DEFAULT '0' COMMENT '状态：0:等待采购;1：等待二次采购；2、采购完成',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_id` int(11) DEFAULT '0' COMMENT '客户id',
  `customer_name` char(150) DEFAULT '' COMMENT '客户名称',
  `purchase_type` varchar(50) DEFAULT '' COMMENT '物料采购类型',
  `remark` varchar(255) DEFAULT '' COMMENT '报表备注',
  `materials_check` tinyint(1) NOT NULL DEFAULT '0' COMMENT '报表审核 1已审核2已结算',
  `materials_check_time` timestamp NOT NULL COMMENT '审核时间',
  `materials_check_id` int(11) NOT NULL COMMENT '审核人',
  `settle_id` int(11) NOT NULL COMMENT '结算人',
  `settle_time` timestamp NOT NULL COMMENT '结算时间',
  PRIMARY KEY (`order_materials_id`),
  KEY `order_id` (`order_id`),
  KEY `order_no` (`order_no`),
  KEY `idx_materials` (`purchase_no`,`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=205102 DEFAULT CHARSET=utf8 COMMENT='订单物料表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials_difference`
--

DROP TABLE IF EXISTS `erp_order_materials_difference`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials_difference` (
  `materials_difference_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_materials_id` int(11) NOT NULL COMMENT '订单物料ID',
  `order_id` int(11) NOT NULL,
  `order_no` char(30) DEFAULT '' COMMENT '订单编号|批次号',
  `order_num` int(5) DEFAULT '0' COMMENT '订单数',
  `order_type` enum('FOB','CMT','ODM','新CMT') DEFAULT NULL COMMENT '订单类型',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `sku_id` int(11) DEFAULT '0',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `sku_type` enum('女装','男装','童装') DEFAULT NULL COMMENT 'SKU类型',
  `producer_id` int(8) DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(50) DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `producer_branch_id_1` int(5) DEFAULT '0' COMMENT '生产方一级部门ID',
  `materials_id` int(11) DEFAULT '0' COMMENT '物料ID',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_unit` char(10) DEFAULT '' COMMENT '物料单位',
  `materials_single` float DEFAULT '0' COMMENT '客户单耗',
  `materials_category` enum('主面料','面料','里布','衬布','辅料','夹棉') DEFAULT NULL,
  `materials_weaving_type` enum('梭织','针织') DEFAULT NULL COMMENT '编织类型（物料）',
  `output_count` float DEFAULT '0' COMMENT '首页出仓数',
  `second_output_count` float DEFAULT '0' COMMENT '二次出仓数',
  `init_second_time` timestamp NULL DEFAULT NULL COMMENT '二次采购发起时间',
  `expect_num` int(5) DEFAULT '0' COMMENT '预裁件数',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数(填写)',
  `actual_code` char(150) DEFAULT '' COMMENT '实裁码数(填写)',
  `actual_count` float DEFAULT '0' COMMENT '实裁件数用量=客户单耗*实裁件数',
  `difference_count` float DEFAULT '0' COMMENT '差异数=实裁件数用量-首次出仓娄-二次出仓数',
  `difference_status` tinyint(1) DEFAULT '0' COMMENT '状态：0、等待审核;1、审核通过；2、审核失败，3、发起二次采购',
  `store_branch` char(50) DEFAULT '' COMMENT '入仓部门',
  `check_user_id` int(8) DEFAULT '0',
  `check_user_name` char(30) DEFAULT '',
  `check_remark` varchar(250) DEFAULT '',
  `check_time` timestamp NULL DEFAULT NULL,
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_id` int(11) DEFAULT '0' COMMENT '客户id',
  `customer_name` char(150) DEFAULT '' COMMENT '客户名称',
  PRIMARY KEY (`materials_difference_id`),
  KEY `order_id` (`order_id`,`order_materials_id`),
  KEY `order_no` (`order_no`),
  KEY `order_materials_id` (`order_materials_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='裁床管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials_purchase`
--

DROP TABLE IF EXISTS `erp_order_materials_purchase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials_purchase` (
  `order_purchase_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_materials_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `order_no` char(30) DEFAULT '' COMMENT '订单编号|批次号',
  `order_num` int(5) DEFAULT '0' COMMENT '订单数',
  `order_type` char(20) DEFAULT '' COMMENT '订单类型',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '下单时间',
  `order_first_flag` tinyint(1) DEFAULT '0' COMMENT '1、首单标识',
  `order_exigence_flag` tinyint(1) DEFAULT '0' COMMENT '1、紧急标识',
  `order_stocked_type` enum('普通备货','尾货','其他') DEFAULT NULL COMMENT '备货类型',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂目标日期',
  `production_num` int(5) DEFAULT '0' COMMENT '生产件数',
  `sku_id` int(8) DEFAULT '0',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `branch_id_1` int(5) DEFAULT '0' COMMENT '生产方id',
  `branch_name_1` char(50) DEFAULT '' COMMENT '生产方名称',
  `supplier_id` int(8) DEFAULT '0' COMMENT '供应商ID',
  `supplier_name` char(50) DEFAULT '' COMMENT '供应商名称',
  `second_flag` tinyint(1) DEFAULT '0' COMMENT '1、二次采购标志',
  `materials_id` int(11) DEFAULT '0' COMMENT '物料ID',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_unit` char(10) DEFAULT '' COMMENT '物料单位',
  `materials_category` enum('主面料','面料','里布','衬布','辅料','夹棉') DEFAULT '辅料' COMMENT '物料类型',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT '客户单价',
  `materials_price` decimal(8,2) DEFAULT '0.00' COMMENT '物料单价=客户单价*单件用量',
  `materials_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户金额',
  `materials_single` float DEFAULT '0' COMMENT '单件用量|客户单耗',
  `materials_weaving_type` enum('梭织','针织') DEFAULT NULL COMMENT '编织类型（物料）',
  `materials_color` char(30) DEFAULT '' COMMENT '物料颜色',
  `single_num` int(5) DEFAULT '0' COMMENT '客户单耗件数=（主面料）打卷米数/客户单耗',
  `expect_single` float DEFAULT '0' COMMENT '预裁单耗',
  `expect_num` int(5) DEFAULT '0' COMMENT '预裁件数=打卷米数/预裁单耗',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数(填写)',
  `actual_code` char(150) DEFAULT '' COMMENT '实裁码数(填写)',
  `purchase_no` char(30) DEFAULT '' COMMENT '采购号',
  `purchase_expect_count` int(5) DEFAULT '0' COMMENT '应采购数量=客户单耗件数*单件用量（二次采购，该字段为指定值）',
  `purchase_need_count` int(5) NOT NULL DEFAULT '0' COMMENT '要求采购数=应采购数-调取库存数量',
  `purchase_actual_count` float NOT NULL DEFAULT '0' COMMENT '采购数量（填写）',
  `purchase_meter_count` float NOT NULL DEFAULT '0' COMMENT '采购米数(填写)面、里料',
  `purchase_kilo_count` float NOT NULL DEFAULT '0' COMMENT '采购KG数(填写)面、里料',
  `purchase_roll_count` float DEFAULT '0' COMMENT '打卷米数',
  `purchase_expect_amount` decimal(8,2) DEFAULT NULL COMMENT '应采购金额=实采购数*客户单价',
  `purchase_actual_amount` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '采购金额（面、里料）：1、（针织）采购金额=采购KG数*采购单价；2、（梭织）采购金额=采购米数*采购单价。采购金额（辅料）=采购数量*采购单价',
  `purchase_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '采购单价（填写）',
  `purchase_full_price` decimal(8,2) DEFAULT '0.00' COMMENT '采购足米价',
  `purchase_bar` char(255) NOT NULL DEFAULT '' COMMENT '采购条数（填写）',
  `purchase_cm` char(10) DEFAULT '' COMMENT '幅宽(cm)',
  `purchase_kg` char(10) DEFAULT '' COMMENT '克重g/m2',
  `purchase_diff` float DEFAULT '0' COMMENT '空差',
  `purchase_paper` float DEFAULT '0' COMMENT '纸筒',
  `purchase_user_id` int(10) NOT NULL DEFAULT '0' COMMENT '采购人ID',
  `purchase_user_name` char(50) NOT NULL DEFAULT '' COMMENT '采购人姓名',
  `purchase_remark` varchar(250) DEFAULT '' COMMENT '采购备注',
  `purchase_status` tinyint(1) DEFAULT '-1' COMMENT '采购状态：-3、退料完成,-2、等待退料,-1:等待确认库存,0、等待采购，1、采购完成,2、入仓完成',
  `color_user_id` int(8) DEFAULT '0' COMMENT '（面料）批色用户ID',
  `color_user_name` char(30) DEFAULT '' COMMENT '（面料）批色用户姓名',
  `color_status` tinyint(1) DEFAULT '-1' COMMENT '批色状态：-1、无批色，0、等待批色，1、批色完成',
  `color_time` timestamp NULL DEFAULT NULL COMMENT '（面料）批色时间',
  `pick_flag` tinyint(1) DEFAULT '0' COMMENT '1、MES领料标识',
  `add_user_id` int(11) DEFAULT '0',
  `add_user_name` char(30) DEFAULT '',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_id` int(11) DEFAULT '0' COMMENT '客户id',
  `customer_name` char(150) DEFAULT '' COMMENT '客户名称',
  `materials_no` char(30) DEFAULT '' COMMENT '物料sku',
  `supplier_id_2` int(11) DEFAULT '0' COMMENT '原供应商',
  `supplier_name_2` char(50) DEFAULT '' COMMENT '原供应商名称',
  `purchase_type` char(20) DEFAULT '',
  `purchase_real_time` timestamp NULL DEFAULT NULL,
  `purchase_need_time` timestamp NULL DEFAULT NULL,
  `process_str` varchar(250) DEFAULT '',
  `compensate_num` decimal(8,2) DEFAULT '0.00' COMMENT '补损',
  `purchase_num` decimal(8,2) DEFAULT '0.00' COMMENT '采购数',
  `purchase_unit` tinyint(1) DEFAULT '1' COMMENT '采购单位',
  `purchase_amount` decimal(8,2) DEFAULT '0.00' COMMENT '采购金额',
  `compensate_count` decimal(8,2) DEFAULT '0.00' COMMENT '累计补损数',
  `refund_num` decimal(8,2) DEFAULT '0.00' COMMENT '退料数',
  `storage_num` decimal(8,2) DEFAULT '0.00' COMMENT '入仓数',
  PRIMARY KEY (`order_purchase_id`),
  KEY `order_id` (`order_id`,`order_materials_id`),
  KEY `order_no` (`order_no`),
  KEY `order_materials_id` (`order_materials_id`),
  KEY `supplier_name` (`supplier_name`)
) ENGINE=InnoDB AUTO_INCREMENT=35117 DEFAULT CHARSET=utf8 COMMENT='采购记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials_purchase_log`
--

DROP TABLE IF EXISTS `erp_order_materials_purchase_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials_purchase_log` (
  `log_id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '日志记录',
  `order_id` int(11) NOT NULL COMMENT '订单id',
  `order_materials_id` int(11) NOT NULL COMMENT '订单物料id',
  `content` varchar(500) DEFAULT NULL COMMENT '操作日志记录',
  `user_id` int(11) NOT NULL COMMENT '操作人',
  `user_name` varchar(10) DEFAULT NULL,
  `add_time` timestamp NULL DEFAULT NULL COMMENT '操作时间',
  PRIMARY KEY (`log_id`),
  KEY `order_materials_id` (`order_materials_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials_purchase_record`
--

DROP TABLE IF EXISTS `erp_order_materials_purchase_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials_purchase_record` (
  `record_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_purchase_id` int(11) NOT NULL DEFAULT '0',
  `supplier_id` int(11) NOT NULL DEFAULT '0' COMMENT '供应商',
  `purchase_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '采购单价',
  `purchase_amount` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '采购金额',
  `purchase_unit` tinyint(1) NOT NULL DEFAULT '1' COMMENT '采购单位 1米数,2公斤数',
  `purchase_num` decimal(8,2) DEFAULT '0.00' COMMENT '采购数',
  `compensate_num` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '扣损',
  `storage_num` decimal(8,2) DEFAULT NULL COMMENT '入仓数',
  `user_id` int(11) NOT NULL DEFAULT '0' COMMENT '操作人',
  `store_no` varchar(50) NOT NULL DEFAULT '' COMMENT '入库仓位',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `refund_code` varchar(500) NOT NULL DEFAULT '[]' COMMENT '退料码数',
  `refund_num` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '退料数',
  `refund_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '退料人',
  `refund_time` timestamp NULL DEFAULT NULL COMMENT '退料时间',
  `refund_remark` text COMMENT '退料备注',
  `check_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '审核状态0未审核1已审核',
  `check_user_id` int(11) DEFAULT NULL COMMENT '审核人',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`record_id`),
  KEY `order_purchase_id` (`order_purchase_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35406 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_materials_refund`
--

DROP TABLE IF EXISTS `erp_order_materials_refund`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_materials_refund` (
  `refund_id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '退料',
  `type` tinyint(1) DEFAULT '1' COMMENT '1采购退料 2裁床余料',
  `refund_unit` tinyint(1) DEFAULT '1' COMMENT '1,米数 2公斤数',
  `order_id` int(11) unsigned NOT NULL COMMENT '订单id',
  `order_materials_id` int(11) unsigned NOT NULL COMMENT '物料id，关联采购列表',
  `metres_num` decimal(8,2) unsigned NOT NULL DEFAULT '0.00' COMMENT '退料数',
  `metres_code` varchar(500) DEFAULT '[]' COMMENT '米数详情',
  `cloth_diff` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '空差',
  `strip_number` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '条数',
  `content` varchar(1000) NOT NULL DEFAULT '' COMMENT '退料原因',
  `status` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '0等待审核，1同意退料，2拒绝退料',
  `user_id` int(11) NOT NULL DEFAULT '0' COMMENT '操作人',
  `user_name` varchar(20) NOT NULL DEFAULT '',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`refund_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='订单退换料表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_message`
--

DROP TABLE IF EXISTS `erp_order_message`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_message` (
  `message_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单id',
  `user_id` int(11) NOT NULL DEFAULT '0' COMMENT '用户id',
  `user_name` varchar(100) NOT NULL DEFAULT '' COMMENT '用户名称',
  `message_content` text COMMENT '备注内容',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '备注时间',
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3161 DEFAULT CHARSET=utf8 COMMENT='订单留言板';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_process`
--

DROP TABLE IF EXISTS `erp_order_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_process` (
  `order_process_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单ID',
  `process_id` int(11) NOT NULL DEFAULT '0' COMMENT '工艺id',
  `to_supplier_id` int(11) NOT NULL DEFAULT '0' COMMENT '实发工艺厂',
  `unit_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '实发价格',
  `ship_num` smallint(7) NOT NULL DEFAULT '0' COMMENT '发货数量',
  `ship_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '发货人',
  `ship_time` timestamp NULL DEFAULT NULL COMMENT '发货时间',
  `back_num` smallint(7) NOT NULL DEFAULT '0' COMMENT '回料数量',
  `back_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '回料人',
  `back_time` timestamp NULL DEFAULT NULL COMMENT '回料时间',
  `total_price` decimal(8,2) DEFAULT '0.00' COMMENT '总额',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0等待送出，1等待回料，2完成',
  PRIMARY KEY (`order_process_id`),
  KEY `order_id` (`order_id`),
  KEY `process_id` (`process_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11062 DEFAULT CHARSET=utf8 COMMENT='SKU工艺费用表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_change`
--

DROP TABLE IF EXISTS `erp_order_production_change`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_change` (
  `production_change_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `sku_id` int(8) DEFAULT '0',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_type` enum('女装','男装','童装') DEFAULT NULL COMMENT '服装类型',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型',
  `materials_id` int(11) DEFAULT '0',
  `materials_name` char(150) DEFAULT '',
  `production_reason` char(100) DEFAULT '' COMMENT '生产原因',
  `production_person` char(150) DEFAULT '' COMMENT '生产人员',
  `production_price` float DEFAULT '0' COMMENT '单价',
  `production_num` int(5) DEFAULT '0' COMMENT '件数',
  `production_amount` decimal(8,2) DEFAULT '0.00' COMMENT '生产费用=单价*件数',
  `production_payer` char(30) DEFAULT '' COMMENT '生产付款方',
  `production_start_time` timestamp NULL DEFAULT NULL COMMENT '生产开始时间',
  `old_producer_id` int(8) DEFAULT '0' COMMENT '前生产方ID',
  `old_producer_name` char(30) DEFAULT '' COMMENT '前生产方名称',
  `producer_id` int(8) DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `change_remark` varchar(250) DEFAULT '' COMMENT '申请原因',
  `change_status` tinyint(1) DEFAULT '-1' COMMENT '状态 -1:等待确认,0:等待审核，1:完成',
  `check_user_id` int(8) DEFAULT '0' COMMENT '审核人ID',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_remark` varchar(250) DEFAULT '' COMMENT '审核备注',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`production_change_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='生产异常变动表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_cutting`
--

DROP TABLE IF EXISTS `erp_order_production_cutting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_cutting` (
  `production_cutting_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `expect_num` int(5) DEFAULT '0' COMMENT '应裁床数',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数(填写)',
  `actual_code` text COMMENT '实裁码数(填写)',
  `actual_remark` varchar(250) DEFAULT '' COMMENT '实裁备注',
  `actual_user_id` int(8) DEFAULT '0' COMMENT '实裁操作员ID',
  `actual_user_name` char(30) DEFAULT '' COMMENT '实裁操作员姓名',
  `actual_need_time` timestamp NULL DEFAULT NULL COMMENT '要求实裁时间',
  `actual_real_time` timestamp NULL DEFAULT NULL COMMENT '实际实裁时间',
  `cutting_require` varchar(250) DEFAULT '' COMMENT '裁床要求',
  `color_flag` tinyint(1) DEFAULT '0' COMMENT '1、面料已批色',
  `pick_flag` tinyint(1) DEFAULT '0' COMMENT '1、MES领料标识',
  `refund_remark` varchar(300) DEFAULT '' COMMENT '拒绝原因',
  `refund_check_time` timestamp NULL DEFAULT NULL COMMENT '拒绝时间',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id_2` int(11) DEFAULT '0' COMMENT '二级部门',
  `branch_name_2` char(50) DEFAULT '' COMMENT '二级部门名称',
  `branch_id_3` int(11) DEFAULT '0' COMMENT '三级部门',
  `branch_name_3` char(50) DEFAULT '' COMMENT '三级部门名称',
  `cutting_status` int(1) DEFAULT '0' COMMENT '裁床状态 0等待裁床1裁床中2裁床完成',
  `user_id` int(11) DEFAULT '0',
  `user_name` char(50) DEFAULT '' COMMENT '备注人姓名',
  `remake` varchar(500) DEFAULT '' COMMENT '备注',
  `remake_time` timestamp NULL DEFAULT NULL COMMENT '备注时间',
  `diff_num` int(10) DEFAULT '0' COMMENT '裁数差异',
  `diff_amount` float(7,2) DEFAULT '0.00' COMMENT '差异金额',
  `cutting_branch_id_1` int(11) DEFAULT '0' COMMENT '裁床生产方',
  `cutting_branch_name_1` char(50) DEFAULT '',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '0系统未执行1系统已执行',
  `is_standard` tinyint(1) DEFAULT '0' COMMENT '时效是否达标 0,未执行 1,达标 2,不达标',
  `hours` smallint(5) DEFAULT '0' COMMENT '裁床耗时',
  `lining_cloth` char(20) NOT NULL DEFAULT '' COMMENT '里布用量',
  `impact_cloth_1` char(20) NOT NULL DEFAULT '' COMMENT '撞布1',
  `impact_cloth_2` char(20) NOT NULL DEFAULT '' COMMENT '撞布2',
  `patch` char(20) NOT NULL DEFAULT '' COMMENT '纸朴',
  `primary_cloth` char(20) NOT NULL DEFAULT '' COMMENT '主布用量',
  `primary_cloth_width` int(5) DEFAULT '0' COMMENT '幅宽',
  `primary_cloth_height` int(5) DEFAULT '0' COMMENT '长度',
  `is_exe` tinyint(1) DEFAULT '0' COMMENT '执行状态',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `opt_user` int(10) DEFAULT NULL COMMENT '操作人',
  `use_ratio` float DEFAULT '0' COMMENT '利用率',
  PRIMARY KEY (`production_cutting_id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8070 DEFAULT CHARSET=utf8 COMMENT='裁床管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_cutting_copy`
--

DROP TABLE IF EXISTS `erp_order_production_cutting_copy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_cutting_copy` (
  `production_cutting_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `expect_num` int(5) DEFAULT '0' COMMENT '应裁床数',
  `actual_num` int(5) DEFAULT '0' COMMENT '实裁件数(填写)',
  `actual_code` varchar(1000) DEFAULT '' COMMENT '实裁码数(填写)',
  `actual_remark` varchar(250) DEFAULT '' COMMENT '实裁备注',
  `actual_user_id` int(8) DEFAULT '0' COMMENT '实裁操作员ID',
  `actual_user_name` char(30) DEFAULT '' COMMENT '实裁操作员姓名',
  `actual_need_time` timestamp NULL DEFAULT NULL COMMENT '要求实裁时间',
  `actual_real_time` timestamp NULL DEFAULT NULL COMMENT '实际实裁时间',
  `cutting_require` varchar(250) DEFAULT '' COMMENT '裁床要求',
  `color_flag` tinyint(1) DEFAULT '0' COMMENT '1、面料已批色',
  `pick_flag` tinyint(1) DEFAULT '0' COMMENT '1、MES领料标识',
  `refund_remark` varchar(300) DEFAULT '' COMMENT '拒绝原因',
  `refund_check_time` timestamp NULL DEFAULT NULL COMMENT '拒绝时间',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id_2` int(11) DEFAULT '0' COMMENT '二级部门',
  `branch_name_2` char(50) DEFAULT '' COMMENT '二级部门名称',
  `branch_id_3` int(11) DEFAULT '0' COMMENT '三级部门',
  `branch_name_3` char(50) DEFAULT '' COMMENT '三级部门名称',
  `cutting_status` int(1) DEFAULT '0' COMMENT '裁床状态 0等待裁床1裁床中2裁床完成',
  `user_id` int(11) DEFAULT '0',
  `user_name` char(50) DEFAULT '' COMMENT '备注人姓名',
  `remake` varchar(500) DEFAULT '' COMMENT '备注',
  `remake_time` timestamp NULL DEFAULT NULL COMMENT '备注时间',
  `diff_num` int(10) DEFAULT '0' COMMENT '裁数差异',
  `diff_amount` float(7,2) DEFAULT '0.00' COMMENT '差异金额',
  `cutting_branch_id_1` int(11) DEFAULT '0' COMMENT '裁床生产方',
  `cutting_branch_name_1` char(50) DEFAULT '',
  `is_system` tinyint(1) DEFAULT '0' COMMENT '0系统未执行1系统已执行',
  `is_standard` tinyint(1) DEFAULT '0' COMMENT '时效是否达标 0,未执行 1,达标 2,不达标',
  `hours` smallint(5) DEFAULT '0' COMMENT '裁床耗时',
  `primary_cloth` char(20) NOT NULL DEFAULT '' COMMENT '主布用量',
  `lining_cloth` char(20) NOT NULL DEFAULT '' COMMENT '里布用量',
  `impact_cloth_1` char(20) NOT NULL DEFAULT '' COMMENT '撞布1',
  `impact_cloth_2` char(20) NOT NULL DEFAULT '' COMMENT '撞布2',
  `patch` char(20) NOT NULL DEFAULT '' COMMENT '纸朴',
  PRIMARY KEY (`production_cutting_id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2948 DEFAULT CHARSET=utf8 COMMENT='裁床管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_receive_dispatch`
--

DROP TABLE IF EXISTS `erp_order_production_receive_dispatch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_receive_dispatch` (
  `receive_dispatch_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单id',
  `dispatch_num` int(7) NOT NULL DEFAULT '0' COMMENT '车缝发出数量',
  `dispatch_code` text NOT NULL,
  `dispatch_user_id` int(11) NOT NULL DEFAULT '0',
  `dispatch_user_name` varchar(50) NOT NULL DEFAULT '' COMMENT '车缝操作人',
  `dispatch_time` timestamp NULL DEFAULT NULL,
  `receive_num` int(7) NOT NULL DEFAULT '0' COMMENT '尾部接收数量',
  `receive_code` text NOT NULL,
  `receive_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '尾部接收人',
  `receive_user_name` varchar(50) NOT NULL DEFAULT '',
  `receive_time` timestamp NULL DEFAULT NULL,
  `remake` varchar(500) NOT NULL DEFAULT '',
  `check_user_id` int(11) NOT NULL DEFAULT '0',
  `check_user_name` varchar(50) NOT NULL DEFAULT '' COMMENT '车缝审核人',
  `check_time` timestamp NULL DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `check_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0未审核已审核',
  `faulty_code` text NOT NULL COMMENT '次品数量',
  `faulty_num` int(7) NOT NULL DEFAULT '0',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0车缝发货1尾部收货',
  `complete_time` timestamp NULL DEFAULT NULL COMMENT '车缝回货时间',
  `dispatch_need_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '车缝开始时间',
  `dispatch_real_time` timestamp NULL DEFAULT NULL COMMENT '车缝结束时间',
  `is_standard` tinyint(1) DEFAULT '0' COMMENT '时效是否达标 0,未执行 1,达标 2,不达标',
  `hours` smallint(5) DEFAULT '0' COMMENT '车缝耗时',
  PRIMARY KEY (`receive_dispatch_id`),
  KEY `dispatch_time` (`dispatch_time`)
) ENGINE=InnoDB AUTO_INCREMENT=8002 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_sewing`
--

DROP TABLE IF EXISTS `erp_order_production_sewing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_sewing` (
  `production_sewing_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `production_price` decimal(8,2) DEFAULT '0.00' COMMENT '生产单价(车缝)',
  `production_num` int(5) DEFAULT '0' COMMENT '生产件数',
  `cutting_time` timestamp NULL DEFAULT NULL COMMENT '裁剪完毕时间',
  `sewing_remark` varchar(250) DEFAULT '' COMMENT '登记备注',
  `sewing_user_id` int(8) DEFAULT '0' COMMENT '登记操作员ID',
  `sewing_user_name` char(30) DEFAULT '' COMMENT '登记操作员姓名',
  `sewing_need_time` timestamp NULL DEFAULT NULL COMMENT '要求时间',
  `sewing_real_time` timestamp NULL DEFAULT NULL COMMENT '实际时间|下线时间',
  `sewing_status` tinyint(1) DEFAULT '0' COMMENT '状态：-1:删除,0:等待确认,1、等待登记，2、车缝完成',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id_2` int(11) DEFAULT '0',
  `branch_name_2` char(50) DEFAULT '',
  `branch_id_3` int(11) DEFAULT '0',
  `branch_name_3` char(50) DEFAULT '',
  `sewing_branch_id_1` int(11) DEFAULT '0',
  `sewing_branch_name_1` char(50) DEFAULT '',
  PRIMARY KEY (`production_sewing_id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8002 DEFAULT CHARSET=utf8 COMMENT='车缝管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_tail`
--

DROP TABLE IF EXISTS `erp_order_production_tail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_tail` (
  `production_tail_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `production_price` decimal(8,2) DEFAULT '0.00' COMMENT '生产单价(尾部)',
  `weaving_type` enum('梭织','针织') DEFAULT NULL COMMENT '编织类型',
  `accept_code` text COMMENT '接收码数',
  `accept_num` int(7) DEFAULT '0' COMMENT '接收件数',
  `tail_remark` varchar(250) DEFAULT '' COMMENT '登记备注',
  `tail_user_id` int(8) DEFAULT '0' COMMENT '登记操作员ID',
  `tail_user_name` char(30) DEFAULT '' COMMENT '登记操作员姓名',
  `tail_need_time` timestamp NULL DEFAULT NULL COMMENT '要求时间',
  `tail_real_time` timestamp NULL DEFAULT NULL COMMENT '实际时间|下线时间',
  `tail_status` tinyint(1) DEFAULT '0' COMMENT '状态：0、等待开始，1、登记中，2、登记完成',
  `shipment_code` text COMMENT '出货码数',
  `shipment_num` int(7) DEFAULT '0' COMMENT '出货数',
  `defective_code` text COMMENT '次品码数',
  `defective_num` int(7) DEFAULT '0' COMMENT '次品件数',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `branch_id_2` int(11) DEFAULT '0',
  `branch_name_2` char(50) DEFAULT '',
  `branch_id_3` int(11) DEFAULT '0',
  `branch_name_3` char(50) DEFAULT '',
  `swap_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0待接收1已接收2已完成',
  `tail_branch_id_1` int(11) DEFAULT '0',
  `tail_branch_name_1` char(50) DEFAULT '',
  `is_abnormal` tinyint(1) DEFAULT '0' COMMENT '是否异常',
  `is_check` tinyint(1) DEFAULT '0' COMMENT '是否审核',
  PRIMARY KEY (`production_tail_id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='尾部管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_production_work`
--

DROP TABLE IF EXISTS `erp_order_production_work`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_production_work` (
  `production_work_id` int(11) NOT NULL AUTO_INCREMENT,
  `union_id` int(11) DEFAULT '0' COMMENT '裁床表，车缝表，尾部表',
  `work_class` char(10) DEFAULT '' COMMENT '类型',
  `group_id` int(10) DEFAULT '0' COMMENT '工种',
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `order_no` char(30) DEFAULT '' COMMENT '订单编号',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `work_id` int(11) DEFAULT NULL COMMENT '工种序号',
  `work_type` char(50) DEFAULT '' COMMENT '工种（从常用参数获取）',
  `processes_id` int(11) DEFAULT '0' COMMENT '工序',
  `processes_name` varchar(100) DEFAULT '' COMMENT '工序名称',
  `user_id` int(5) DEFAULT '0' COMMENT '员工ID',
  `user_name` char(30) DEFAULT '' COMMENT '员工姓名',
  `work_code` char(30) DEFAULT '' COMMENT '加工尺码',
  `work_num` int(5) NOT NULL DEFAULT '0' COMMENT '加工件数',
  `work_price` decimal(8,2) DEFAULT '0.00' COMMENT '岗位单价',
  `work_amount` decimal(8,2) DEFAULT '0.00' COMMENT '岗位工资=岗位单价*加工件数',
  `work_time` date DEFAULT NULL COMMENT '结算时间',
  `remark` varchar(255) DEFAULT '' COMMENT '备注',
  `opt_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '操作人',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  `is_check` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否审核',
  `is_abnormal` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否异常',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`production_work_id`),
  KEY `production_class` (`work_class`),
  KEY `order_id` (`order_id`),
  KEY `order_no` (`order_no`),
  KEY `sku_no` (`sku_no`),
  KEY `work_type` (`work_type`),
  KEY `union_id` (`union_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8002 DEFAULT CHARSET=utf8 COMMENT='订单生产工种加工费登记表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_refund`
--

DROP TABLE IF EXISTS `erp_order_refund`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_refund` (
  `order_refund_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂目标日期',
  `first_code` char(150) DEFAULT '' COMMENT '首次发货件数',
  `second_code` char(150) DEFAULT '' COMMENT '二次发货件数',
  `lack_code` char(150) DEFAULT '' COMMENT '缺少件数',
  `lack_reason` varchar(250) DEFAULT '' COMMENT '缺少原因',
  `quality_result` varchar(250) DEFAULT '' COMMENT '质检结果',
  `repair_need_time` timestamp NULL DEFAULT NULL COMMENT '要求返修完毕时间',
  `duty_person` char(30) DEFAULT '' COMMENT '责任人',
  `duty_fine_amount` decimal(8,2) DEFAULT '0.00' COMMENT '罚款金额',
  `return_person` char(30) DEFAULT '' COMMENT '退货责任人',
  `return_fine_amount` decimal(8,2) DEFAULT '0.00' COMMENT '退货罚款',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '申请员ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '申请员姓名',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `check_user_id` int(8) DEFAULT '0' COMMENT '审核人',
  `check_user_name` char(30) DEFAULT '' COMMENT '审核人姓名',
  `check_remark` varchar(250) DEFAULT '' COMMENT '审核备注',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `refund_status` tinyint(1) DEFAULT '-1' COMMENT '状态：-1:等待确认,0、等待审核，1、审核完成',
  PRIMARY KEY (`order_refund_id`),
  KEY `order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='退货管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_repertory`
--

DROP TABLE IF EXISTS `erp_order_repertory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_repertory` (
  `order_repertory_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL COMMENT '订单id',
  `order_no` char(30) DEFAULT '',
  `order_type` char(30) DEFAULT '',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '下单时间',
  `order_materials_id` int(11) NOT NULL COMMENT '订单物料id',
  `order_purchase_id` int(11) NOT NULL DEFAULT '0',
  `our_delivery_date` date DEFAULT NULL COMMENT '本厂交期',
  `producer_id` int(8) NOT NULL DEFAULT '0' COMMENT '生产方ID',
  `producer_name` char(30) DEFAULT '' COMMENT '生产方名称',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `sku_id` int(8) NOT NULL DEFAULT '0',
  `sku_no` char(30) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `materials_id` int(11) NOT NULL DEFAULT '0',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称',
  `materials_unit` char(10) DEFAULT '' COMMENT '物料单位',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_category` enum('主面料','面料','里布','衬布','辅料') DEFAULT NULL COMMENT '物料类型',
  `materials_weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型(面料)',
  `materials_kg` char(10) DEFAULT '' COMMENT '克重g/m2',
  `materials_color` char(30) DEFAULT '' COMMENT '物料颜色',
  `materials_single` float DEFAULT '0' COMMENT '单件用量',
  `purchase_expect_count` int(5) DEFAULT '0' COMMENT '应采购数量',
  `purchase_actual_count` float DEFAULT '0' COMMENT '实采购数量',
  `purchase_kilo_count` float DEFAULT '0' COMMENT '采购KG数',
  `purchase_roll_count` float DEFAULT '0' COMMENT '实际打卷米数|应入库数量',
  `purchase_bar` char(30) DEFAULT '' COMMENT '采购条数|打卷条数',
  `purchase_cm` char(10) DEFAULT '' COMMENT '幅宽cm',
  `purchase_kg` char(10) DEFAULT '' COMMENT '克重',
  `purchase_diff` float DEFAULT '0' COMMENT '空差',
  `purchase_paper` float DEFAULT '0' COMMENT '纸筒',
  `purchase_time` timestamp NULL DEFAULT NULL COMMENT '采购时间',
  `second_flag` tinyint(1) DEFAULT '0' COMMENT '1、二次入库标识，对应二次采购',
  `process_name` char(50) DEFAULT '' COMMENT '二次工艺，多个用逗号隔开',
  `input_user_id` int(11) DEFAULT '0' COMMENT '入库操作人ID',
  `input_user_name` char(50) DEFAULT '' COMMENT '入库操作人姓名',
  `input_kilo_count` float DEFAULT '0' COMMENT '入库KG数',
  `input_count` float DEFAULT '0' COMMENT '入库数量',
  `input_count_tmp` float DEFAULT '0' COMMENT '临时入库数量',
  `input_bar` char(50) DEFAULT '' COMMENT '入库条数',
  `input_remark` varchar(250) DEFAULT '' COMMENT '入仓备注',
  `input_need_time` timestamp NULL DEFAULT NULL COMMENT '要求入库时间',
  `input_real_time` timestamp NULL DEFAULT NULL COMMENT '完成入库时间',
  `output_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '出库操作人ID',
  `output_user_name` char(50) NOT NULL DEFAULT '' COMMENT '出库操作人姓名',
  `output_expect_count` float DEFAULT '0' COMMENT '预裁出仓数=预裁总件数*客户单耗',
  `output_actual_count` float DEFAULT '0' COMMENT '实裁出仓数=实裁总件数*客户单耗',
  `output_count` float unsigned NOT NULL DEFAULT '0' COMMENT '出库数量',
  `output_count_tmp` float DEFAULT '0' COMMENT '临时出库数量',
  `output_bar` char(50) NOT NULL DEFAULT '' COMMENT '出库条数',
  `output_kg` char(30) DEFAULT '' COMMENT '出仓克重，针织面料填写克重',
  `output_remark` varchar(250) DEFAULT '' COMMENT '出库备注',
  `output_need_time` timestamp NULL DEFAULT NULL COMMENT '要求出库时间',
  `output_real_time` timestamp NULL DEFAULT NULL COMMENT '完成出库时间',
  `receive_user_id` int(8) DEFAULT '0' COMMENT '领料操作人ID',
  `receive_user_name` char(30) DEFAULT '' COMMENT '领料操作人姓名',
  `receive_count` float DEFAULT '0' COMMENT '领料数量',
  `receive_bar` char(50) DEFAULT '' COMMENT '领料条数',
  `receive_signature` char(150) DEFAULT '' COMMENT '领料人签名，电子签图片URL',
  `receive_need_time` timestamp NULL DEFAULT NULL COMMENT '要求领料时间',
  `receive_real_time` timestamp NULL DEFAULT NULL COMMENT '完成领料时间',
  `sign_user_id` int(8) DEFAULT '0',
  `sign_user_name` char(30) DEFAULT '',
  `sign_count` float DEFAULT '0' COMMENT '签收数量',
  `sign_bar` char(20) DEFAULT '' COMMENT '签收条数',
  `sign_signature` char(150) DEFAULT '',
  `sign_time` timestamp NULL DEFAULT NULL COMMENT '签收时间',
  `color_flag` tinyint(1) DEFAULT '0' COMMENT '1、面料已批色',
  `init_second_time` timestamp NULL DEFAULT NULL COMMENT '发起二次采购时间',
  `refund_check_time` timestamp NULL DEFAULT NULL,
  `repertory_status` tinyint(1) DEFAULT '-1' COMMENT '状态：-3、退料完成,-2、等待退料,-1:等待确认,0、等待入仓,1、等待二次工艺完成,2、等待配料,3、等待出仓,4、等待领料,5、等待签收,6,完成',
  `repertory_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `materials_no` char(50) DEFAULT '' COMMENT '物料sku',
  `store_no` char(50) DEFAULT '' COMMENT '入库库位',
  `customer_id` int(11) DEFAULT '0' COMMENT '客户id',
  `customer_name` char(50) DEFAULT '' COMMENT '客户名称',
  `branch_id_1` int(11) NOT NULL DEFAULT '0' COMMENT '工厂',
  `branch_id_2` int(11) NOT NULL DEFAULT '0' COMMENT '部门',
  `branch_id_3` int(11) NOT NULL DEFAULT '0' COMMENT '组',
  `receive_name` varchar(10) DEFAULT '' COMMENT '领料人',
  `branch_name_1` varchar(10) DEFAULT '',
  PRIMARY KEY (`order_repertory_id`),
  KEY `order_id` (`order_id`,`order_materials_id`),
  KEY `order_no` (`order_no`),
  KEY `purchase_id` (`order_purchase_id`),
  KEY `order_materials_id` (`order_materials_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35117 DEFAULT CHARSET=utf8 COMMENT='订单物料仓库管理-出入记录';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_repertory_record`
--

DROP TABLE IF EXISTS `erp_order_repertory_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_repertory_record` (
  `record_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_repertory_id` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '入仓id',
  `receive_num` decimal(8,2) unsigned DEFAULT '0.00' COMMENT '领料数',
  `receive_name` varchar(10) DEFAULT '' COMMENT '领料人',
  `remark` text COMMENT '备注',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '操作人',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `refund_code` varchar(500) DEFAULT NULL COMMENT '余料码数',
  `refund_num` decimal(8,2) DEFAULT '0.00' COMMENT '退料数',
  `refund_user_id` int(11) DEFAULT '0' COMMENT '退料人',
  `refund_time` timestamp NULL DEFAULT NULL COMMENT '退料时间',
  `refund_remark` text COMMENT '退料备注',
  `check_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '审核状态0未审核1已审核',
  `check_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '审核人',
  `check_time` timestamp NULL DEFAULT NULL COMMENT '审核时间',
  `branch_id_1` int(11) NOT NULL DEFAULT '0' COMMENT '工厂',
  `branch_id_2` int(11) NOT NULL DEFAULT '0' COMMENT '部门',
  `branch_id_3` int(11) NOT NULL DEFAULT '0' COMMENT '组',
  PRIMARY KEY (`record_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33079 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_report`
--

DROP TABLE IF EXISTS `erp_order_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_report` (
  `order_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `order_no` char(50) NOT NULL DEFAULT '' COMMENT '订单编号|批次号',
  `sku_no` char(50) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型',
  `order_first_flag` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1、首单标识，0、返单标识',
  `order_type` enum('FOB','CMT','ODM','新CMT') NOT NULL DEFAULT 'FOB' COMMENT '订单类型',
  `producer_id` int(8) DEFAULT '0',
  `producer_name` char(30) NOT NULL DEFAULT '' COMMENT '生产方名称',
  `order_time` timestamp NULL DEFAULT NULL COMMENT '客户下单时间',
  `order_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '订单单价',
  `order_total_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '订单总价=订单单价*订单数量',
  `order_delivery_date` date DEFAULT NULL COMMENT '目标交付日期|客户交期',
  `order_number` varchar(350) DEFAULT '' COMMENT '订单件数JSON',
  `order_materials` text COMMENT '订单物料JSON',
  `materials_diff_amount` decimal(8,2) DEFAULT '0.00' COMMENT '物料总差异',
  `sku_cost` varchar(350) DEFAULT '' COMMENT 'SKU成本JSON',
  `order_pricing` varchar(1000) DEFAULT '' COMMENT '调价信息JSON',
  `order_process` varchar(350) DEFAULT '' COMMENT '二次工艺JSON',
  `order_cost` varchar(350) DEFAULT '' COMMENT '订单成本JSON',
  `order_outgoing_price` decimal(8,2) DEFAULT '0.00' COMMENT '外发单价',
  `order_outgoing_amount` decimal(8,2) DEFAULT '0.00' COMMENT '外发金额',
  `order_line_amount` decimal(8,2) DEFAULT '0.00' COMMENT '线（线厂单独本登记）',
  `order_freight_amount` decimal(8,2) DEFAULT '0.00' COMMENT '运费均摊金额',
  `order_fine_user` char(30) DEFAULT '' COMMENT '被罚款人',
  `order_fine_amount` decimal(8,2) DEFAULT '0.00' COMMENT '罚款金额',
  `order_cut_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户扣款金额',
  `profit_loss_amount` decimal(8,2) DEFAULT '0.00' COMMENT '单款盈亏',
  `order_cost_profit` decimal(8,2) DEFAULT '0.00' COMMENT '加工费单款总利润',
  `order_materials_profit` decimal(8,2) DEFAULT '0.00' COMMENT '物料单款总利润',
  `order_profit_amount` decimal(8,2) DEFAULT '0.00' COMMENT '加利润后的盈亏',
  `tail_finish_time` timestamp NULL DEFAULT NULL COMMENT '本厂出货时间',
  `client_receiving_time` timestamp NULL DEFAULT NULL COMMENT '客户入仓时间',
  `client_payment_time` timestamp NULL DEFAULT NULL COMMENT '客户结款时间',
  `client_order_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户应结款金额=客户单价*出货件数',
  `client_payment_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户实际结款金额',
  `client_diff_amount` decimal(8,2) DEFAULT '0.00' COMMENT '客户结款差额=客户实际结款金额-客户应结款金额',
  `profit_rate` decimal(8,2) DEFAULT '0.00' COMMENT '利润率',
  `report_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '状态，参考订单状态表',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  PRIMARY KEY (`order_id`),
  KEY `inx_orderNo` (`order_no`,`sku_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='订单单款盈亏表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_require`
--

DROP TABLE IF EXISTS `erp_order_require`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_require` (
  `require_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单ID',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'SKU ID',
  `produce_category` tinyint(4) NOT NULL DEFAULT '0' COMMENT '生产分类',
  `require_name` varchar(255) NOT NULL DEFAULT '' COMMENT '要求名称',
  `require_desc` text COMMENT '要求内容',
  `is_title` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否标题',
  `add_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`require_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_sku_id` (`sku_id`),
  KEY `idx_produce_category` (`produce_category`)
) ENGINE=InnoDB AUTO_INCREMENT=6563 DEFAULT CHARSET=utf8mb4 COMMENT='订单生产要求（含包装要求）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_shipment`
--

DROP TABLE IF EXISTS `erp_order_shipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_shipment` (
  `order_shipment_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0',
  `defective_num` int(3) DEFAULT '0' COMMENT '次品件数',
  `defective_code` varchar(1000) NOT NULL DEFAULT '[]' COMMENT '次品码数',
  `shipment_num` int(10) NOT NULL DEFAULT '0' COMMENT '出货数',
  `shipment_code` varchar(1000) NOT NULL DEFAULT '{}' COMMENT '出货码数，格式 [S:10,M,20]',
  `shipment_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '出货人id',
  `shipment_user_name` char(30) NOT NULL DEFAULT '' COMMENT '出货人姓名',
  `shipment_real_time` timestamp NULL DEFAULT NULL COMMENT '实际出货时间',
  `shipment_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0:等待出货，1:出货完成',
  `shipment_remark` text,
  `delivery_num` int(5) NOT NULL DEFAULT '0' COMMENT '收货数',
  `delivery_code` varchar(500) NOT NULL DEFAULT '{}' COMMENT '收货码数，格式 [S:10,M,20]',
  `delivery_user_id` int(8) NOT NULL DEFAULT '0' COMMENT '收货人ID',
  `delivery_user_name` char(30) NOT NULL DEFAULT '' COMMENT '收货人姓名',
  `delivery_status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0:待收货，1:待审核 2已完成',
  `delivery_remark` text,
  `delivery_real_time` timestamp NULL DEFAULT NULL COMMENT '收货时间',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `is_system` tinyint(1) unsigned DEFAULT '0' COMMENT '系统是否执行过',
  `shipment_start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '尾部开始时间',
  `shipment_end_time` timestamp NULL DEFAULT NULL COMMENT '尾部结束时间',
  `is_standard` tinyint(1) DEFAULT NULL COMMENT '时效是否达标 0,未执行 1,达标 2,不达标',
  `hours` smallint(5) DEFAULT NULL COMMENT '车缝耗时',
  `is_craft` tinyint(1) DEFAULT '0' COMMENT '是否包含二次工艺',
  `is_exe` tinyint(1) DEFAULT '0',
  `shipment_remark2` text COMMENT '尾部前备注',
  `shipment_quantity` int(10) DEFAULT '0' COMMENT '实际收货数',
  `abnormal_quantiy` int(10) DEFAULT '0' COMMENT '异常数量',
  PRIMARY KEY (`order_shipment_id`),
  KEY `order_id` (`order_id`),
  KEY `shipment_real_time` (`shipment_real_time`)
) ENGINE=InnoDB AUTO_INCREMENT=7954 DEFAULT CHARSET=utf8 COMMENT='订单收发货表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_size`
--

DROP TABLE IF EXISTS `erp_order_size`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_size` (
  `size_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单ID',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'SKU ID',
  `order_no` varchar(50) NOT NULL DEFAULT '' COMMENT '订单号',
  `order_time` datetime DEFAULT NULL COMMENT '下单时间',
  `site_1` varchar(255) NOT NULL DEFAULT '' COMMENT '部位',
  `site_1_1` varchar(255) NOT NULL DEFAULT '' COMMENT '英文部位',
  `site_2` varchar(255) NOT NULL DEFAULT '' COMMENT '量法',
  `site_3` varchar(255) NOT NULL DEFAULT '' COMMENT '纸样尺寸',
  `site_4` varchar(255) NOT NULL DEFAULT '' COMMENT '样衣尺寸',
  `site_5` varchar(255) NOT NULL DEFAULT '' COMMENT '公差',
  `site_6` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸1',
  `site_7` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸2',
  `site_8` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸3',
  `site_9` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸4',
  `site_10` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸5',
  `site_11` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸6',
  `site_12` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸7',
  `site_13` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸8',
  `site_14` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸9',
  `site_15` varchar(50) NOT NULL DEFAULT '0' COMMENT '尺寸10',
  `is_title` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否标题行',
  `sort` int(11) NOT NULL DEFAULT '0' COMMENT '排序',
  `add_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`size_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_sku_id` (`sku_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16473 DEFAULT CHARSET=utf8mb4 COMMENT='订单尺寸信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_sku_require`
--

DROP TABLE IF EXISTS `erp_order_sku_require`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_sku_require` (
  `require_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0',
  `sku_id` int(11) NOT NULL DEFAULT '0',
  `is_title` tinyint(1) DEFAULT '0' COMMENT '是否是表头',
  `produce_category` tinyint(3) NOT NULL DEFAULT '1' COMMENT '1裁床，2车缝，3尾部',
  `require_name` varchar(50) NOT NULL DEFAULT '' COMMENT '要求名称',
  `require_desc` text COMMENT '要求描述',
  PRIMARY KEY (`require_id`),
  KEY `sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_sku_size`
--

DROP TABLE IF EXISTS `erp_order_sku_size`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_sku_size` (
  `size_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT '0',
  `sku_id` varchar(11) NOT NULL DEFAULT '0',
  `is_title` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否是表头',
  `site_1` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_1_1` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_2` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_3` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_4` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_5` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_6` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_7` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_8` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_9` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_10` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_11` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_12` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `sort` int(5) NOT NULL DEFAULT '100' COMMENT '排序',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '字段位置',
  PRIMARY KEY (`size_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_status`
--

DROP TABLE IF EXISTS `erp_order_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_status` (
  `status_id` tinyint(1) NOT NULL DEFAULT '0',
  `status_name` char(30) DEFAULT '',
  `main_flag` tinyint(1) DEFAULT '1' COMMENT '1、主要状态',
  `remark` varchar(150) DEFAULT '',
  PRIMARY KEY (`status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='订单状态表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_store`
--

DROP TABLE IF EXISTS `erp_order_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_store` (
  `store_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '成衣库存',
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单id',
  `certified_code` text COMMENT '正品数量',
  `certified_num` int(7) NOT NULL DEFAULT '0',
  `certified_site` char(20) DEFAULT '' COMMENT '正品库位',
  `substandard_code` text COMMENT '次品数量',
  `substandard_num` int(7) NOT NULL DEFAULT '0',
  `substandard_site` char(20) DEFAULT '' COMMENT '次品库位',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0仓库收货，1仓库发货，2发货完成',
  `opt_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '操作人',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '操作时间',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加事件',
  PRIMARY KEY (`store_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7941 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_order_store_record`
--

DROP TABLE IF EXISTS `erp_order_store_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_order_store_record` (
  `record_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '操作记录',
  `type` tinyint(1) NOT NULL COMMENT '1入库2出库',
  `store_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单库存id',
  `order_id` int(11) NOT NULL DEFAULT '0' COMMENT '订单id',
  `certified_code` text COMMENT '正品码数',
  `certified_num` int(7) NOT NULL DEFAULT '0' COMMENT '正品数',
  `certified_site` char(20) NOT NULL DEFAULT '' COMMENT '正品位置',
  `substandard_code` text COMMENT '次品码数',
  `substandard_num` int(7) NOT NULL DEFAULT '0' COMMENT '次品数量',
  `substandard_site` char(20) NOT NULL DEFAULT '' COMMENT '次品位置',
  `opt_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '操作人',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '操作时间',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  PRIMARY KEY (`record_id`)
) ENGINE=InnoDB AUTO_INCREMENT=207 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_general`
--

DROP TABLE IF EXISTS `erp_repertory_general`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_general` (
  `repertory_general_id` int(11) NOT NULL AUTO_INCREMENT,
  `general_name` char(50) DEFAULT '' COMMENT '货物名称',
  `general_no` char(30) NOT NULL DEFAULT '' COMMENT '货物编号',
  `general_image` char(150) DEFAULT '' COMMENT '货物图片',
  `repertory_count` int(8) DEFAULT '0' COMMENT '库存数量',
  `general_unit` char(10) DEFAULT '' COMMENT '单位',
  `opt_user_id` int(8) DEFAULT '0',
  `opt_user_name` char(30) DEFAULT '',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `store_no` char(30) DEFAULT '' COMMENT '入库库位',
  `customer_id` int(11) DEFAULT NULL COMMENT '客户ID',
  PRIMARY KEY (`repertory_general_id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8 COMMENT='通用物料库存表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_general_history`
--

DROP TABLE IF EXISTS `erp_repertory_general_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_general_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `repertory_general_id` int(11) NOT NULL DEFAULT '0',
  `change_type` char(50) NOT NULL DEFAULT '' COMMENT '采购入库，生产出库，工艺出库',
  `change_count` int(8) NOT NULL DEFAULT '0' COMMENT '变更数量',
  `last_count` int(8) NOT NULL DEFAULT '0' COMMENT '变更后数量',
  `opt_user_id` int(8) NOT NULL DEFAULT '0' COMMENT '操作人ID',
  `opt_user_name` char(30) NOT NULL DEFAULT '' COMMENT '操作人姓名',
  `opt_remark` varchar(250) NOT NULL DEFAULT '' COMMENT '申请备注',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '申请时间',
  `store_no` char(30) NOT NULL DEFAULT '' COMMENT '入库库位',
  PRIMARY KEY (`history_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8 COMMENT='通用物料库存变更历史表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_materials`
--

DROP TABLE IF EXISTS `erp_repertory_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_materials` (
  `repertory_materials_id` int(11) NOT NULL AUTO_INCREMENT,
  `repertory_class` tinyint(5) DEFAULT NULL COMMENT '仓库类型 1面料仓2辅料仓',
  `repertory_count` decimal(8,2) DEFAULT '0.00' COMMENT '库存数量',
  `materials_no` char(50) DEFAULT '' COMMENT '物料编号',
  `materials_name` char(150) DEFAULT '' COMMENT '物料名称',
  `materials_unit` char(50) DEFAULT '' COMMENT '物料单位',
  `store_no` char(50) DEFAULT '' COMMENT '入库库位',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_type` enum('针织','梭织') DEFAULT NULL COMMENT '面料类型',
  `materials_category` enum('主面料','面料','里布','衬布','辅料') DEFAULT '辅料' COMMENT '物料类型',
  `materials_color` char(30) DEFAULT '' COMMENT '物料颜色',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近操作时间',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `materials_sub_category` varchar(50) DEFAULT NULL COMMENT '辅料子类',
  `customer_id` int(11) DEFAULT NULL COMMENT '客户ID',
  `allow_flag` int(11) DEFAULT NULL,
  PRIMARY KEY (`repertory_materials_id`),
  KEY `opt_user_id` (`opt_user_id`),
  KEY `materials_no` (`materials_no`)
) ENGINE=InnoDB AUTO_INCREMENT=5256 DEFAULT CHARSET=utf8 COMMENT='物料仓库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_materials_copy`
--

DROP TABLE IF EXISTS `erp_repertory_materials_copy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_materials_copy` (
  `repertory_materials_id` int(11) NOT NULL AUTO_INCREMENT,
  `repertory_class` tinyint(5) DEFAULT NULL COMMENT '仓库类型 1面料仓2辅料仓',
  `repertory_count` decimal(8,2) DEFAULT '0.00' COMMENT '库存数量',
  `materials_no` char(50) DEFAULT '' COMMENT '物料编号',
  `materials_name` char(150) DEFAULT '' COMMENT '物料名称',
  `materials_unit` char(50) DEFAULT '' COMMENT '物料单位',
  `store_no` char(50) DEFAULT '' COMMENT '入库库位',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `materials_type` enum('针织','梭织') DEFAULT NULL COMMENT '面料类型',
  `materials_category` enum('主面料','面料','里布','衬布','辅料') DEFAULT '辅料' COMMENT '物料类型',
  `materials_color` char(30) DEFAULT '' COMMENT '物料颜色',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近操作时间',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`repertory_materials_id`),
  KEY `opt_user_id` (`opt_user_id`),
  KEY `materials_no` (`materials_no`)
) ENGINE=InnoDB AUTO_INCREMENT=2133 DEFAULT CHARSET=utf8 COMMENT='物料仓库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_materials_history`
--

DROP TABLE IF EXISTS `erp_repertory_materials_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_materials_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `repertory_materials_id` int(11) DEFAULT NULL,
  `order_no` char(30) DEFAULT '' COMMENT '批次号,调用物料必填',
  `order_purchase_id` int(11) DEFAULT '0' COMMENT '采购ID',
  `change_type` char(50) DEFAULT '' COMMENT '采购入库，生产出库，工艺出库',
  `change_count` char(20) DEFAULT '' COMMENT '变更数量',
  `change_status` tinyint(1) DEFAULT '0' COMMENT '状态:0、等待审核，1、变更完成,2：拒绝变更',
  `last_count` int(11) DEFAULT '0' COMMENT '变更后数量',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '操作人姓名',
  `opt_remark` varchar(250) DEFAULT '' COMMENT '操作备注',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`history_id`),
  KEY `opt_user_id` (`opt_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=81183 DEFAULT CHARSET=utf8 COMMENT='物料仓库变更历史表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_sku`
--

DROP TABLE IF EXISTS `erp_repertory_sku`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_sku` (
  `repertory_sku_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_no` char(30) NOT NULL COMMENT 'SKU编号',
  `certified_code` varchar(1000) NOT NULL DEFAULT '[]' COMMENT '正品码数',
  `certified_num` int(11) NOT NULL DEFAULT '0' COMMENT '正品数量',
  `certified_site` char(30) DEFAULT '' COMMENT '正品库位',
  `substandard_code` varchar(1000) NOT NULL DEFAULT '[]' COMMENT '次品码数',
  `substandard_num` int(8) NOT NULL DEFAULT '0' COMMENT '次品数量',
  `substandard_site` char(30) NOT NULL DEFAULT '' COMMENT '次品库位',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `opt_remake` varchar(250) NOT NULL DEFAULT '' COMMENT '备注',
  `opt_user_id` int(11) DEFAULT NULL COMMENT '操作人',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '操作时间',
  `customer_id` int(11) DEFAULT NULL COMMENT '客户ID',
  `inbound_department_id` int(11) DEFAULT NULL COMMENT '入库部门',
  PRIMARY KEY (`repertory_sku_id`),
  UNIQUE KEY `sku_no` (`sku_no`)
) ENGINE=InnoDB AUTO_INCREMENT=162 DEFAULT CHARSET=utf8 COMMENT='成衣库存表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_repertory_sku_history`
--

DROP TABLE IF EXISTS `erp_repertory_sku_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_repertory_sku_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `repertory_sku_id` int(11) DEFAULT NULL,
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `order_no` char(30) DEFAULT '' COMMENT '批次号',
  `change_type` char(20) DEFAULT '' COMMENT '1入库，2出库，3手动调整',
  `certified_code` text,
  `certified_num` int(7) DEFAULT '0',
  `certified_site` char(30) DEFAULT '',
  `substandard_code` text,
  `substandard_num` int(7) DEFAULT '0',
  `substandard_site` char(30) DEFAULT '',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '操作人ID',
  `opt_remake` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '操作时间',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `sku_no` (`sku_no`),
  KEY `opt_user_id` (`opt_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=201 DEFAULT CHARSET=utf8 COMMENT='物料仓库变更历史表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku`
--

DROP TABLE IF EXISTS `erp_sku`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku` (
  `sku_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_no` char(50) NOT NULL COMMENT 'SKU编号',
  `sku_type` char(20) DEFAULT '' COMMENT 'SKU类型',
  `sku_image` varchar(500) DEFAULT '' COMMENT 'SKU图片',
  `sku_photos` varchar(500) DEFAULT '' COMMENT 'SKU相册',
  `sku_author` char(20) DEFAULT '' COMMENT 'SKU作者',
  `sku_code` text COMMENT 'sku尺码价格',
  `sku_price` decimal(8,2) DEFAULT '0.00' COMMENT '成本单价（含利润）（客户总价）',
  `sku_profit` decimal(8,2) DEFAULT '0.00' COMMENT '成本利润',
  `sku_production_price` decimal(8,2) DEFAULT '0.00' COMMENT 'SKU客户加工费单价',
  `sku_production_profit` decimal(8,2) DEFAULT '0.00' COMMENT 'SKU客户加工费利润',
  `sku_hours` char(10) DEFAULT '' COMMENT 'SKU工时=车缝单价(加工成本，类型为车缝)/(广州最低工资标准）/21.7天/8小时/60%',
  `customer_id` int(10) DEFAULT NULL COMMENT '客户id',
  `salesman_user_id` int(11) DEFAULT '0' COMMENT '业务员id',
  `customer_name` char(150) DEFAULT '' COMMENT '客户名称',
  `design_no` char(50) DEFAULT '' COMMENT 'SKU设计款号',
  `cutting_number` int(5) DEFAULT '0' COMMENT '裁片数',
  `bind_number` char(50) DEFAULT '' COMMENT '捆条用量',
  `bind_type` enum('内捆','外捆','无捆条') DEFAULT NULL COMMENT '捆条类型',
  `bind_width` char(50) DEFAULT '' COMMENT '捆条宽度',
  `bind_line` char(30) DEFAULT '' COMMENT '捆条纹路',
  `process_str` char(150) DEFAULT '' COMMENT '工艺项目，多项目用英文逗号隔开',
  `before_require` char(150) DEFAULT '' COMMENT '裁前要求',
  `cutting_require` char(150) DEFAULT '' COMMENT '裁床要求',
  `sewing_require` char(150) DEFAULT '' COMMENT '车缝要求',
  `tail_waistband_flag` tinyint(1) DEFAULT '0' COMMENT '1、有腰带',
  `tail_waistline_flag` tinyint(1) DEFAULT '0' COMMENT '1、需订腰绳',
  `tail_handwork_str` char(150) DEFAULT '' COMMENT '手工项目，多项目用英文逗号隔开',
  `tail_machine_str` char(150) DEFAULT '' COMMENT '专机项目，多项目用英文逗号隔开',
  `tail_button_flag` tinyint(1) DEFAULT '0' COMMENT '1、需备用扣',
  `tail_require` char(150) DEFAULT '' COMMENT '尾部要求',
  `quality_results` text COMMENT '质检结果',
  `difficulty_level` char(50) DEFAULT '' COMMENT '难易度',
  `quality_image` char(150) DEFAULT '' COMMENT '质检图片',
  `weaving_type` enum('针织','梭织','') DEFAULT '' COMMENT '编织类型',
  `material_price` decimal(8,2) DEFAULT '0.00' COMMENT '物料成本',
  `handwork_price` decimal(8,2) DEFAULT '0.00' COMMENT '手工成本',
  `machine_price` decimal(8,2) DEFAULT '0.00' COMMENT '专机成本',
  `process_price` decimal(8,2) DEFAULT '0.00' COMMENT '工艺成本',
  `profits_price` decimal(8,2) DEFAULT '0.00' COMMENT '利润',
  `production_price` decimal(8,2) DEFAULT '0.00' COMMENT '加工费',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '-1为删除 0:等待完善 1:正常',
  `check_status` tinyint(1) DEFAULT '0' COMMENT '0未锁定1已锁定，sku不可修改',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '最近操作时间',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `sku_color_code` varchar(500) NOT NULL DEFAULT '' COMMENT 'sku颜色组',
  `sku_size_code` varchar(500) NOT NULL DEFAULT '' COMMENT 'sku尺码组',
  `cutting_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '裁床总价',
  `sewing_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '车缝总价',
  `tail_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '尾部总价',
  `system_status` tinyint(1) DEFAULT '0' COMMENT '是否执行',
  `production_profits` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '加工倍率',
  `production_unit_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '加工单价',
  `sku_proportion` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '价格倍率',
  `secondary_cloth` char(20) DEFAULT '' COMMENT '配布',
  `secondary_cloth_A` char(20) DEFAULT '' COMMENT '配布A',
  `secondary_cloth_B` char(20) DEFAULT '' COMMENT '配布B',
  `cut_parts` char(20) DEFAULT '' COMMENT '裁片',
  `process_complete_date` date DEFAULT NULL COMMENT '工序完成时间',
  `primary_cloth` char(20) DEFAULT '' COMMENT '主布',
  `primary_cloth_width` int(5) DEFAULT NULL COMMENT '主料宽度',
  `primary_cloth_height` int(5) DEFAULT NULL COMMENT '主料长度',
  `is_exe` tinyint(1) DEFAULT '0' COMMENT '是否执行',
  `is_size_template` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否尺码模板',
  `template_name` varchar(50) DEFAULT '' COMMENT '模板名称',
  `processing_type` tinyint(1) DEFAULT '0' COMMENT '0=无,1=成品,2=定制',
  PRIMARY KEY (`sku_id`),
  UNIQUE KEY `sku_no` (`sku_no`),
  KEY `opt_user_id` (`opt_user_id`),
  KEY `sku_type` (`sku_type`),
  KEY `customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14038 DEFAULT CHARSET=utf8 COMMENT='商品表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_cost`
--

DROP TABLE IF EXISTS `erp_sku_cost`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_cost` (
  `cost_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `cost_class` enum('手工','专机','利润') DEFAULT NULL,
  `cost_name` char(50) DEFAULT '' COMMENT '成本名称，从常用参数中选择',
  `cost_price` decimal(8,2) DEFAULT '0.00' COMMENT '成本单价',
  `cost_unit` char(10) DEFAULT '' COMMENT '成本单位',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近操作时间',
  PRIMARY KEY (`cost_id`),
  KEY `sku_id` (`sku_id`),
  KEY `sku_no` (`sku_no`),
  KEY `opt_user_id` (`opt_user_id`),
  KEY `cost_class` (`cost_class`),
  KEY `cost_name` (`cost_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 COMMENT='SKU成本费用表\r\n(手工、专机、利润)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_cost_category`
--

DROP TABLE IF EXISTS `erp_sku_cost_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_cost_category` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_no` char(30) DEFAULT '',
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `category_name` char(30) DEFAULT '' COMMENT '分类',
  `little_sum_cost` decimal(8,2) DEFAULT '0.00' COMMENT '小计',
  `sum_cost_desc` char(150) DEFAULT '' COMMENT '合计',
  `sum_cost_total` decimal(8,2) DEFAULT '0.00' COMMENT '总额（含利润）',
  `cost_profit` decimal(8,2) DEFAULT '0.00' COMMENT '利润',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  KEY `sku_no` (`sku_no`,`category_name`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21709 DEFAULT CHARSET=utf8 COMMENT='客户SKU核算分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_cost_detail`
--

DROP TABLE IF EXISTS `erp_sku_cost_detail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_cost_detail` (
  `detail_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) DEFAULT '0',
  `order_id` int(11) DEFAULT '0' COMMENT '订单ID',
  `title` char(50) DEFAULT '' COMMENT '项目',
  `material_meter` char(30) DEFAULT '' COMMENT '物料小计(元)',
  `price` char(30) DEFAULT '' COMMENT '价格(元)',
  `unit_price` char(30) DEFAULT '' COMMENT '单价(元)',
  `simple_account` char(30) DEFAULT '' COMMENT '单件净用量',
  `simple_use` char(30) DEFAULT '' COMMENT '单件净用量(含损耗)',
  `supplier_loss` char(30) DEFAULT '' COMMENT '供应商损耗',
  `supplier_profit` char(30) DEFAULT '' COMMENT '供应商利润',
  PRIMARY KEY (`detail_id`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=105762 DEFAULT CHARSET=utf8 COMMENT='客户SKU核算详情表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_file`
--

DROP TABLE IF EXISTS `erp_sku_file`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_file` (
  `file_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT '关联sku表',
  `file_type` char(20) NOT NULL DEFAULT '' COMMENT '文件类别',
  `file_tab` char(20) NOT NULL DEFAULT '' COMMENT '文件标识',
  `file_addr` char(50) DEFAULT '' COMMENT '文件地址',
  `sort` int(7) DEFAULT '100' COMMENT '排序',
  PRIMARY KEY (`file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=232 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_log`
--

DROP TABLE IF EXISTS `erp_sku_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` int(10) DEFAULT NULL,
  `content` text,
  `operate_user` int(10) DEFAULT NULL,
  `update_time` int(10) DEFAULT NULL,
  `create_time` int(10) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40641 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_materials`
--

DROP TABLE IF EXISTS `erp_sku_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_materials` (
  `materials_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) NOT NULL COMMENT 'SKU ID',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `materials_no` char(30) DEFAULT '' COMMENT '物料编号',
  `materials_name` char(150) DEFAULT '' COMMENT '物料名称',
  `materials_image` char(150) DEFAULT '' COMMENT '物料图片',
  `sku_color` char(50) DEFAULT '' COMMENT 'sku颜色组中的一',
  `materials_weaving_type` enum('针织','梭织') DEFAULT NULL COMMENT '编织类型（物料）',
  `materials_category` enum('主面料','面料','里布','衬布','辅料','夹棉') DEFAULT '辅料' COMMENT '物料类型',
  `materials_main_flag` tinyint(1) DEFAULT '0' COMMENT '1、主料标识',
  `supplier_id` int(8) DEFAULT '0' COMMENT '供应商ID',
  `supplier_name` char(100) DEFAULT '' COMMENT '供应商名称',
  `supplier_color_no` char(30) DEFAULT '' COMMENT '物料色号',
  `supplier_phone` char(15) DEFAULT '' COMMENT '供应商联系电话',
  `supplier_address` char(100) DEFAULT '' COMMENT '供应商联系地址',
  `materials_color` char(100) DEFAULT '' COMMENT '物料颜色',
  `materials_element` char(50) DEFAULT '' COMMENT '物料成分',
  `materials_single` char(30) DEFAULT '' COMMENT '单件用量',
  `materials_unit` char(30) DEFAULT '' COMMENT '物料单位',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT '客户单价',
  `full_price` decimal(8,2) DEFAULT '0.00' COMMENT '足米价',
  `materials_loss` tinyint(1) DEFAULT '0' COMMENT '物料损耗',
  `materials_price` decimal(8,2) DEFAULT '0.00' COMMENT '物料单价=单件用量*物料单价',
  `materials_kg` char(10) DEFAULT '' COMMENT '克重g/m2',
  `materials_cm` char(10) DEFAULT '' COMMENT '幅宽(cm)',
  `materials_diff` float DEFAULT '0' COMMENT '空差',
  `materials_paper` float DEFAULT '0' COMMENT '纸筒',
  `use_part` char(30) DEFAULT '' COMMENT '使用部位',
  `hand_feel_flag` tinyint(1) DEFAULT '0' COMMENT '1、留手感样标识',
  `cutting_number` float DEFAULT '0' COMMENT '裁片数',
  `binding_number` char(30) DEFAULT '' COMMENT '捆条用量',
  `store_branch` char(30) DEFAULT '' COMMENT '入仓部门，从常用参数用获取',
  `branch_id` int(11) DEFAULT '0' COMMENT '使用部门ID',
  `branch_name` char(30) DEFAULT '' COMMENT '使用部门名称',
  `branch_full` char(50) DEFAULT '' COMMENT '使用部门全称',
  `opt_user_id` int(8) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '最近操作时间',
  `purchase_type` varchar(50) DEFAULT '' COMMENT '物料采购类型',
  `is_exec` tinyint(2) DEFAULT '0',
  `is_compute` tinyint(1) DEFAULT '1' COMMENT '是否成本核算',
  PRIMARY KEY (`materials_id`),
  KEY `sku_id` (`sku_id`),
  KEY `sku_no` (`sku_no`),
  KEY `supplier_id` (`supplier_id`),
  KEY `branch_id` (`branch_id`),
  KEY `opt_user_id` (`opt_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=49141 DEFAULT CHARSET=utf8 COMMENT='SKU物料表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_photo`
--

DROP TABLE IF EXISTS `erp_sku_photo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_photo` (
  `photo_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) DEFAULT '0',
  `sku_no` char(50) DEFAULT '',
  `thumb` char(150) DEFAULT '',
  `image` char(150) DEFAULT '',
  `sort` int(5) DEFAULT '0',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`photo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8 COMMENT='SKU相册表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_process`
--

DROP TABLE IF EXISTS `erp_sku_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_process` (
  `process_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) DEFAULT '0' COMMENT 'SKU ID',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `process_name` char(50) DEFAULT '' COMMENT '工艺名称，从常用参数中选择',
  `supplier_id` int(8) DEFAULT '0' COMMENT '供应商ID',
  `process_price` decimal(8,2) DEFAULT '0.00' COMMENT '工艺价格',
  `unit_consumption` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '工艺单耗',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '最近操作人ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '最近操作人姓名',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近操作时间',
  `process_remark` varchar(250) DEFAULT '' COMMENT '备注',
  `materials_id` int(11) DEFAULT '0' COMMENT '物料ID，成衣工艺时。此时为0',
  `process_class` enum('裁前','裁后','成衣') DEFAULT '成衣' COMMENT '工艺归类',
  `materials_name` char(50) DEFAULT '' COMMENT '物料名称。此时为空',
  `contact_address` char(150) DEFAULT '' COMMENT '供应商联系地址',
  `contact_phone` char(15) DEFAULT '' COMMENT '供应商联系电话',
  `process_unit` char(30) DEFAULT '' COMMENT '工艺单位',
  `supplier_name` char(50) DEFAULT '' COMMENT '供应商名称',
  `unit_price` decimal(8,2) DEFAULT '0.00' COMMENT '工艺单价',
  PRIMARY KEY (`process_id`),
  KEY `sku_no` (`sku_no`),
  KEY `process_name` (`process_name`)
) ENGINE=InnoDB AUTO_INCREMENT=18879 DEFAULT CHARSET=utf8 COMMENT='SKU工艺费用表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_production`
--

DROP TABLE IF EXISTS `erp_sku_production`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_production` (
  `production_id` int(11) NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) DEFAULT '0' COMMENT 'ID',
  `sku_no` char(30) DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) DEFAULT '' COMMENT 'SKU图片',
  `production_class` enum('裁床','车缝','尾部') DEFAULT NULL COMMENT '生产部门',
  `production_price` decimal(8,2) DEFAULT '0.00' COMMENT '部门单价=部门下各工种单价之和',
  PRIMARY KEY (`production_id`),
  KEY `sku_id` (`sku_id`),
  KEY `sku_no` (`sku_no`),
  KEY `production_class` (`production_class`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='SKU加工费表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_production_work`
--

DROP TABLE IF EXISTS `erp_sku_production_work`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_production_work` (
  `production_work_id` int(11) NOT NULL AUTO_INCREMENT,
  `production_id` int(11) NOT NULL,
  `processes_name` varchar(255) NOT NULL DEFAULT '' COMMENT '工序',
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'ID',
  `sku_no` char(30) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `production_class` enum('裁床','车缝','尾部') NOT NULL COMMENT '类型',
  `work_type` char(50) NOT NULL DEFAULT '' COMMENT '工种（从常用参数获取）',
  `work_price` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '工种单价',
  `remark` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  PRIMARY KEY (`production_work_id`),
  KEY `sku_id` (`sku_id`),
  KEY `sku_no` (`sku_no`),
  KEY `work_type` (`work_type`),
  KEY `production_class` (`production_class`),
  KEY `production_id` (`production_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='SKU加工费表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_require`
--

DROP TABLE IF EXISTS `erp_sku_require`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_require` (
  `require_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) NOT NULL DEFAULT '0',
  `is_title` tinyint(1) DEFAULT '0' COMMENT '是否是表头',
  `produce_category` tinyint(3) NOT NULL DEFAULT '1' COMMENT '1裁床，2车缝，3尾部',
  `require_name` varchar(50) NOT NULL DEFAULT '' COMMENT '要求名称',
  `require_desc` text COMMENT '要求描述',
  PRIMARY KEY (`require_id`),
  KEY `sku_id` (`sku_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1565581 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_sample`
--

DROP TABLE IF EXISTS `erp_sku_sample`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_sample` (
  `sample_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_no` char(30) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `sku_image` char(150) NOT NULL DEFAULT '' COMMENT 'SKU图片',
  `qrcode_image` char(150) DEFAULT '' COMMENT '二维码图片地址',
  `customer_flag` tinyint(1) DEFAULT '0' COMMENT '1、客户样衣标识',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：-1、删除；0、仓库中；1、流转中',
  `borrow_user_id` int(8) DEFAULT '0' COMMENT '当前借衣人ID',
  `borrow_user_name` char(30) DEFAULT '' COMMENT '借衣人姓名',
  `borrow_work_type` char(30) DEFAULT '' COMMENT '借衣人职位(工种)',
  `borrow_flag` tinyint(1) DEFAULT '0' COMMENT '借衣标识：0、正常；1、超时',
  `borrow_time` timestamp NULL DEFAULT NULL COMMENT '借衣时间',
  `output_time` timestamp NULL DEFAULT NULL COMMENT '出仓时间',
  `print_times` tinyint(1) DEFAULT '0' COMMENT '打印次数',
  `check_user_id` int(8) DEFAULT '0',
  `check_user_name` char(30) DEFAULT '',
  `check_status` tinyint(1) DEFAULT '0' COMMENT '审核状态：0、等待审核，1、审核完成',
  `check_time` timestamp NULL DEFAULT NULL,
  `opt_user_id` int(8) DEFAULT '0' COMMENT '操作员ID(创建)',
  `opt_user_name` char(30) DEFAULT '' COMMENT '操作员姓名',
  `opt_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `store_no` char(50) DEFAULT '',
  `store_num` smallint(5) NOT NULL DEFAULT '1' COMMENT '样衣数量',
  PRIMARY KEY (`sample_id`),
  KEY `goods_sku` (`sku_no`),
  KEY `customer_flag` (`customer_flag`),
  KEY `status` (`status`),
  KEY `opt_user_id` (`borrow_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='样衣管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_sample_history`
--

DROP TABLE IF EXISTS `erp_sku_sample_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_sample_history` (
  `history_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sample_id` int(11) NOT NULL DEFAULT '0' COMMENT '样衣ID',
  `sku_no` char(30) NOT NULL DEFAULT '' COMMENT 'SKU编号',
  `source` tinyint(1) DEFAULT '1' COMMENT '来源：1、扫码，2、确认入仓',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '状态：0、借衣中；1、已归还',
  `borrow_user_id` int(8) DEFAULT '0' COMMENT '当前借衣人ID',
  `borrow_user_name` char(30) DEFAULT '' COMMENT '借衣人姓名',
  `borrow_work_type` char(30) DEFAULT '' COMMENT '借衣人职位(工种)',
  `borrow_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '借衣时间',
  `also_time` timestamp NULL DEFAULT NULL COMMENT '归还时间',
  PRIMARY KEY (`history_id`),
  KEY `goods_sku` (`sku_no`),
  KEY `status` (`status`),
  KEY `opt_user_id` (`borrow_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='借衣历史表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_size`
--

DROP TABLE IF EXISTS `erp_sku_size`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_size` (
  `size_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` varchar(11) NOT NULL DEFAULT '0',
  `is_title` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否是表头',
  `site_1` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_1_1` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_2` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_3` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_4` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_5` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_6` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_7` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_8` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_9` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_10` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_11` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `site_12` varchar(30) NOT NULL DEFAULT '' COMMENT '字段位置',
  `sort` int(5) NOT NULL DEFAULT '100' COMMENT '排序',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '字段位置',
  PRIMARY KEY (`size_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1414274 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sku_work_processes`
--

DROP TABLE IF EXISTS `erp_sku_work_processes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sku_work_processes` (
  `sku_processes_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sku_id` int(11) NOT NULL DEFAULT '0' COMMENT 'sku',
  `production_class` tinyint(10) NOT NULL DEFAULT '0' COMMENT '生产部门',
  `group_id` int(10) NOT NULL DEFAULT '0' COMMENT '工组',
  `processes_id` int(11) NOT NULL DEFAULT '0' COMMENT '工序Id(非必须)',
  `processes_name` varchar(50) NOT NULL DEFAULT '' COMMENT '工序',
  `work_price` decimal(8,2) DEFAULT '0.00' COMMENT '工序单价',
  `sort` int(7) NOT NULL DEFAULT '100' COMMENT '工序权重',
  `user_id` int(11) NOT NULL COMMENT '操作人',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_exe` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否执行',
  `is_delete` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否删除',
  PRIMARY KEY (`sku_processes_id`),
  KEY `sku_id` (`sku_id`),
  KEY `processes_id` (`processes_id`)
) ENGINE=InnoDB AUTO_INCREMENT=381266 DEFAULT CHARSET=utf8 COMMENT='sku工序表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_supplier_grade`
--

DROP TABLE IF EXISTS `erp_supplier_grade`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_supplier_grade` (
  `grade_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `grade_name` char(5) NOT NULL DEFAULT '' COMMENT '加工厂级别',
  `grade_desc` varchar(255) NOT NULL DEFAULT '' COMMENT '级别描述',
  `ctm_proportion` float(5,2) NOT NULL DEFAULT '0.00' COMMENT '按ctm比例收益',
  `fob_proportion` float(5,2) NOT NULL DEFAULT '0.00' COMMENT '按fob比例收益',
  `sort` int(5) NOT NULL DEFAULT '100' COMMENT '排序',
  PRIMARY KEY (`grade_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_branch`
--

DROP TABLE IF EXISTS `erp_sys_branch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_branch` (
  `branch_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` int(11) NOT NULL COMMENT '上级ID',
  `branch_name` char(100) NOT NULL COMMENT '岗位名称',
  `branch_class` tinyint(1) DEFAULT '1' COMMENT '部门属性：0、供应链，1、总厂,2、分厂,3、外发厂',
  `branch_level` tinyint(1) DEFAULT '3' COMMENT '部门级别:1、一级；2、二级；3、三级',
  `status` tinyint(1) unsigned NOT NULL DEFAULT '1' COMMENT '状态 0：禁用，1启用',
  `grade_name` char(5) NOT NULL DEFAULT '' COMMENT 'ABCDE,供应商级别',
  `factory_id` int(11) NOT NULL DEFAULT '0' COMMENT '加工厂',
  `factory_name` varchar(50) DEFAULT '' COMMENT '加工厂',
  `factory_id_a` int(11) DEFAULT '0' COMMENT '加工厂id',
  `is_exe` tinyint(1) DEFAULT '0' COMMENT '是否执行',
  PRIMARY KEY (`branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=222 DEFAULT CHARSET=utf8 COMMENT='部门结构表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_customer`
--

DROP TABLE IF EXISTS `erp_sys_customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_customer` (
  `customer_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `customer_name` char(150) NOT NULL DEFAULT '' COMMENT '客户名称',
  `contact_person` varchar(100) DEFAULT NULL COMMENT '联系人',
  `customer_no` char(100) NOT NULL DEFAULT '' COMMENT '开户编号',
  `customer_addr` varchar(500) NOT NULL DEFAULT '' COMMENT '客户地址',
  `customer_phone` char(20) NOT NULL DEFAULT '' COMMENT '客户电话',
  `customer_url` varchar(150) NOT NULL DEFAULT '' COMMENT '客户网址',
  `customer_img` varchar(150) DEFAULT '' COMMENT '图片',
  `contacts` varchar(150) NOT NULL DEFAULT '' COMMENT '联系人',
  `credit_line` decimal(8,2) unsigned NOT NULL DEFAULT '0.00' COMMENT '信用额度',
  `judge_level` char(20) NOT NULL DEFAULT '' COMMENT '评审级别',
  `customer_group` varchar(20) DEFAULT NULL COMMENT '客户分组（原评审级别）',
  `product_group` varchar(100) DEFAULT NULL COMMENT '产品分组',
  `xiaoman_company_id` varchar(50) DEFAULT NULL COMMENT '小满客户ID',
  `bail` decimal(8,2) unsigned NOT NULL DEFAULT '0.00' COMMENT '保证金',
  `owing_money` decimal(8,2) DEFAULT '0.00' COMMENT '期初应收款。说明：客户的欠款',
  `discount` decimal(8,2) unsigned NOT NULL DEFAULT '0.00' COMMENT '折扣',
  `profit_scale` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT '利润预提比例',
  `holder_name` char(50) NOT NULL DEFAULT '' COMMENT '开户人',
  `holder_bank` char(50) NOT NULL DEFAULT '' COMMENT '开户银行',
  `holder_number` char(150) NOT NULL DEFAULT '' COMMENT '开户账号',
  `holder_address` char(200) NOT NULL DEFAULT '' COMMENT '开户地址',
  `remake` varchar(500) NOT NULL DEFAULT '' COMMENT '备注',
  `customer_status` tinyint(1) DEFAULT '0' COMMENT '-2删除 -1禁用 0正常',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `take_name` char(50) NOT NULL DEFAULT '' COMMENT '收款人',
  `take_bank` char(50) NOT NULL DEFAULT '' COMMENT '收款银行',
  `take_number` char(100) NOT NULL DEFAULT '' COMMENT '收款账号',
  `subtract_day` char(50) NOT NULL DEFAULT '' COMMENT '货期减天数',
  `owing_way` char(250) NOT NULL DEFAULT '' COMMENT '欠收款方式',
  `salesman_user_id` int(11) NOT NULL DEFAULT '0' COMMENT '业务员id',
  `work_date` char(11) DEFAULT '' COMMENT '合作日期',
  `track_user_id` int(11) DEFAULT '0' COMMENT '英文跟单',
  `track_phone` char(30) DEFAULT '' COMMENT '跟单联系电话',
  `contacts2` text,
  `contacts3` text,
  `payment_type` char(20) DEFAULT '' COMMENT '付款方式',
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2938 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_log`
--

DROP TABLE IF EXISTS `erp_sys_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT '0',
  `log_name` char(200) DEFAULT '' COMMENT '名称',
  `log_class` tinyint(1) DEFAULT '0' COMMENT '0:系统、1:警告、2:错误、3:测试',
  `log_content` text COMMENT '内容',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `log_name` (`log_name`),
  KEY `log_class` (`log_class`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_notice`
--

DROP TABLE IF EXISTS `erp_sys_notice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_notice` (
  `notice_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(250) DEFAULT '',
  `content` text,
  `start_time` date DEFAULT NULL,
  `end_time` date DEFAULT NULL,
  `opt_user_id` int(8) DEFAULT NULL,
  `opt_user_name` char(30) DEFAULT '',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notice_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8 COMMENT='公告表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_notice_read`
--

DROP TABLE IF EXISTS `erp_sys_notice_read`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_notice_read` (
  `read_id` int(11) NOT NULL AUTO_INCREMENT,
  `notice_id` int(11) DEFAULT NULL,
  `user_id` int(8) DEFAULT NULL,
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`read_id`),
  KEY `notice_id` (`notice_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=381 DEFAULT CHARSET=utf8 COMMENT='公告读取记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_param`
--

DROP TABLE IF EXISTS `erp_sys_param`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_param` (
  `id` int(5) NOT NULL AUTO_INCREMENT,
  `class` tinyint(1) DEFAULT '1' COMMENT '参数类型：1、异常；2、FOB、其他时效；3、CMT时效',
  `name` char(30) NOT NULL COMMENT '唯一名称',
  `title` char(30) DEFAULT '' COMMENT '标题',
  `value` char(100) DEFAULT '' COMMENT '首选值(百分比|小时数)',
  `value_1` char(100) DEFAULT '' COMMENT '次选值(数值)',
  `sort` int(5) DEFAULT '100' COMMENT '正常流程权重',
  `remark` char(150) DEFAULT '' COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8 COMMENT='系统参数配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_producer`
--

DROP TABLE IF EXISTS `erp_sys_producer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_producer` (
  `producer_id` int(11) NOT NULL AUTO_INCREMENT,
  `producer_name` char(30) DEFAULT '' COMMENT '别名',
  `producer_grade` enum('A','B','C','D','E') DEFAULT 'A' COMMENT '级别，固定5个级别',
  `producer_type` tinyint(1) DEFAULT '1' COMMENT '接单类型：1、包头尾；2、包头不包尾；3、不包头包尾；4、不包头尾',
  `branch_id` int(11) DEFAULT '0' COMMENT '部门ID',
  `branch_id_2` int(8) DEFAULT '0' COMMENT '二级部门ID',
  `branch_id_1` int(8) DEFAULT '0' COMMENT '一级部门ID(用于权限过滤)',
  `branch_name` char(30) DEFAULT '' COMMENT '部门名称',
  `branch_class` tinyint(1) DEFAULT '1' COMMENT '部门属性：1、总厂,2、分厂,3、外发厂',
  `branch_full` char(100) DEFAULT '' COMMENT '部门全称:二级+三级',
  `branch_number` int(5) DEFAULT '0' COMMENT '部门人数（车缝人数）',
  `contact_name` char(30) DEFAULT '' COMMENT '联系人',
  `contact_phone` char(11) DEFAULT '' COMMENT '联系电话',
  `contact_address` char(150) DEFAULT '' COMMENT '联系地址（工厂地址）',
  `partner_name` char(30) DEFAULT '' COMMENT '合作人',
  `holder_name` char(30) DEFAULT '' COMMENT '开户人',
  `holder_bank` char(150) DEFAULT '' COMMENT '开户银行',
  `holder_number` char(50) DEFAULT '' COMMENT '开户账号',
  `holder_address` char(150) DEFAULT '' COMMENT '开户地址',
  `holder_idcard_1` char(150) DEFAULT '' COMMENT '开户人身份证正面图片地址',
  `holder_idcard_2` char(150) DEFAULT '' COMMENT '开户人身份证反面图片地址',
  `weight_hours` int(5) DEFAULT '0' COMMENT '权重，工时',
  `weight_aging` int(5) DEFAULT '0' COMMENT '权重，时效',
  `weight_quality` int(5) DEFAULT '0' COMMENT '权重，品质',
  `outgo_ratio` decimal(5,2) DEFAULT '0.00' COMMENT '外发，倍率',
  `outgo_wagerate` decimal(5,2) DEFAULT '0.00' COMMENT '外发，工资倍率',
  `outgo_cutting` decimal(5,2) DEFAULT '0.00' COMMENT '外发，裁床单价',
  `outgo_tail` decimal(5,2) DEFAULT '0.00' COMMENT '外发，尾部单价',
  `auto_confirm_hours` int(3) DEFAULT '48' COMMENT '自动确认出仓时间(小时)',
  `minimum_wage` decimal(8,2) DEFAULT '0.00' COMMENT '最低工资标准（填写）',
  `theory_hours` char(10) DEFAULT '' COMMENT '车位理论工时=车缝人数*(小时/天)*小时工资*理论效率',
  `theory_aging` char(10) DEFAULT '' COMMENT '理论效率（填写）',
  `standard_hours` char(30) DEFAULT '' COMMENT '标准工时=车缝人数*(小时/天)*(天数/月)*理论效率',
  `working_hours` char(10) DEFAULT '' COMMENT '小时/天（填写）',
  `working_day` char(10) DEFAULT '' COMMENT '天数/月（填写）',
  `hours_price` decimal(8,2) DEFAULT '0.00' COMMENT '小时工资（填写）',
  `auto_order_number` char(50) DEFAULT '' COMMENT '参与排单件数，多个件数用英文逗号隔开，如果：300,500',
  `auto_order_flag` tinyint(1) DEFAULT '0' COMMENT '1、自动排单标识',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '操作员ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '操作员姓名',
  `opt_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`producer_id`),
  KEY `producer_grade` (`producer_grade`),
  KEY `branch_id` (`branch_id`),
  KEY `order_type` (`producer_type`),
  KEY `auto_confirm_hours` (`auto_confirm_hours`),
  KEY `auto_order_flag` (`auto_order_flag`),
  KEY `opt_user_id` (`opt_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='生产方表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_project`
--

DROP TABLE IF EXISTS `erp_sys_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_project` (
  `project_id` int(5) NOT NULL AUTO_INCREMENT,
  `project_class` char(30) DEFAULT '' COMMENT '项目分类',
  `project_name` char(100) DEFAULT '' COMMENT '项目名称',
  `ext_class` char(30) DEFAULT '' COMMENT '扩展类别，辅助使用',
  `parent_id` int(11) NOT NULL DEFAULT '0' COMMENT '父分组ID(0=顶级主类目)',
  `sort` int(5) DEFAULT '0' COMMENT '排序（从大到小',
  PRIMARY KEY (`project_id`),
  KEY `idx_project_class_parent` (`project_class`,`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2417 DEFAULT CHARSET=utf8 COMMENT='系统常用项目表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_project_class`
--

DROP TABLE IF EXISTS `erp_sys_project_class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_project_class` (
  `class_id` int(5) NOT NULL AUTO_INCREMENT,
  `class_name` char(50) DEFAULT '' COMMENT '名称',
  `sort` int(5) DEFAULT '0' COMMENT '排序（从大到小',
  `show_flag` tinyint(1) DEFAULT '1' COMMENT '1、展示维护标识',
  PRIMARY KEY (`class_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8 COMMENT='系统常用项目分类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_supplier`
--

DROP TABLE IF EXISTS `erp_sys_supplier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_supplier` (
  `supplier_id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier_name` char(30) DEFAULT '' COMMENT '别名',
  `supplier_grade` enum('A','B','C','D','E') DEFAULT 'A' COMMENT '级别，固定5个级别',
  `supplier_type` varchar(100) DEFAULT NULL COMMENT '供应商类型',
  `supplier_scope` char(30) DEFAULT '' COMMENT '业务范围,从常用参数中获取',
  `sign_flag` tinyint(1) DEFAULT '0' COMMENT '1、签约供应商标识',
  `charge_timer` char(30) DEFAULT '' COMMENT '记账时间,从常用参数中获取',
  `checkout_timer` char(30) DEFAULT '' COMMENT '结账时间,从常用参数中获取',
  `contact_name` char(30) DEFAULT '' COMMENT '联系人',
  `contact_phone` char(11) DEFAULT '' COMMENT '联系电话',
  `contact_address` char(150) DEFAULT '' COMMENT '联系地址（工厂地址）',
  `partner_name` char(30) DEFAULT '' COMMENT '合作人',
  `holder_name` char(30) DEFAULT '' COMMENT '开户人',
  `holder_bank` char(150) DEFAULT '' COMMENT '开户银行',
  `holder_number` char(30) DEFAULT '' COMMENT '开户账号',
  `holder_address` char(150) DEFAULT '' COMMENT '开户地址',
  `holder_idcard_1` char(150) DEFAULT '' COMMENT '开户人身份证正面图片地址',
  `holder_idcard_2` char(150) DEFAULT '' COMMENT '开户人身份证反面图片地址',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '操作员ID',
  `opt_user_name` char(30) DEFAULT '' COMMENT '操作员姓名',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '操作时间',
  PRIMARY KEY (`supplier_id`),
  KEY `supplier_grade` (`supplier_grade`),
  KEY `supplier_scope` (`supplier_scope`),
  KEY `sign_flag` (`sign_flag`),
  KEY `charge_timer` (`charge_timer`),
  KEY `checkout_timer` (`checkout_timer`),
  KEY `opt_user_id` (`opt_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=735 DEFAULT CHARSET=utf8 COMMENT='供应商表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_task`
--

DROP TABLE IF EXISTS `erp_sys_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_task` (
  `task_id` int(8) NOT NULL AUTO_INCREMENT,
  `task_name` varchar(50) DEFAULT '',
  `task_action` char(150) DEFAULT '',
  `time_type` tinyint(1) DEFAULT '1' COMMENT '任务类型：1、时段，2、固定时间点',
  `time_interval` int(8) DEFAULT '0' COMMENT '时间间隔',
  `task_status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近更新时间',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`task_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8 COMMENT='系统定时任务表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_sys_wxconfig`
--

DROP TABLE IF EXISTS `erp_sys_wxconfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_sys_wxconfig` (
  `id` int(8) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT '',
  `type` tinyint(1) DEFAULT '1' COMMENT '类型：1、公众号；2、小程序',
  `appid` char(50) DEFAULT '',
  `appsecret` char(150) DEFAULT '',
  `token` char(150) DEFAULT '' COMMENT '验证TOKEN',
  `access_token` char(250) DEFAULT '' COMMENT '动态TOKEN(2小时内有效)',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态：0、无效；1、有效',
  `remark` varchar(250) DEFAULT '' COMMENT '备注',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近更新时间',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 COMMENT='微信信息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_user`
--

DROP TABLE IF EXISTS `erp_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_user` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_name` char(30) DEFAULT '' COMMENT '姓名',
  `user_number` int(10) DEFAULT '0' COMMENT '工号',
  `mobile` char(15) NOT NULL DEFAULT '' COMMENT '手机号',
  `user_idcard` char(20) DEFAULT '' COMMENT '身份证号',
  `email` char(32) DEFAULT '' COMMENT '邮箱',
  `producer_ids` char(250) DEFAULT '' COMMENT '分配生产方ID',
  `branch_id_1` int(11) DEFAULT '0' COMMENT '工厂ID',
  `branch_name_1` char(30) DEFAULT '' COMMENT '工厂名称',
  `branch_id_2` int(8) DEFAULT '0' COMMENT '二级部门ID(用于权限过滤)',
  `branch_name_2` char(30) DEFAULT '' COMMENT '二级组织名称',
  `branch_id_3` char(100) DEFAULT '' COMMENT '部门全称:二级+三级',
  `branch_name_3` char(30) DEFAULT '' COMMENT '三级组织名称',
  `work_type` char(200) DEFAULT '' COMMENT '工种，常用参数表',
  `salary_way` char(30) DEFAULT '' COMMENT '计薪方式，常用参数表',
  `salary_amount` decimal(10,2) DEFAULT '0.00' COMMENT '基本工资',
  `holder_name` char(30) DEFAULT '' COMMENT '开户人',
  `holder_bank` char(150) DEFAULT '' COMMENT '开户银行',
  `holder_number` char(30) DEFAULT '' COMMENT '开户账号',
  `holder_address` char(150) DEFAULT '' COMMENT '开户地址',
  `holder_idcard_1` char(150) DEFAULT '' COMMENT '开户人身份证正面图片地址',
  `holder_idcard_2` char(150) DEFAULT '' COMMENT '开户人身份证反面图片地址',
  `entry_date` date DEFAULT NULL COMMENT '入职时间',
  `leave_date` date DEFAULT NULL COMMENT '离职时间',
  `borrow_flag` tinyint(1) DEFAULT '0' COMMENT '1、借衣标识',
  `payee_flag` tinyint(1) DEFAULT '0' COMMENT '1、领款人标识',
  `operator_flag` tinyint(1) DEFAULT '0' COMMENT '1、系统操作员标识',
  `status` tinyint(4) DEFAULT '0' COMMENT '状态：-1、删除；0：离职；1：在职；2：兼职',
  `add_time` timestamp NULL DEFAULT NULL COMMENT '注册时间',
  `opt_user_id` int(11) DEFAULT '0' COMMENT '操作员ID（最近一次数据变动操作员信息）',
  `opt_user_name` char(30) DEFAULT '' COMMENT '操作员姓名',
  `opt_time` timestamp NULL DEFAULT NULL COMMENT '操作时间',
  `is_accommodation` int(1) DEFAULT '0' COMMENT '1住宿 0不住宿',
  `province` char(50) DEFAULT '' COMMENT '省份',
  `city` char(50) DEFAULT '' COMMENT '城市',
  `county` char(50) DEFAULT '' COMMENT '乡镇',
  `addr` varchar(255) DEFAULT '' COMMENT '地址',
  `is_contract` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否签合同',
  `contract_start` date DEFAULT NULL COMMENT '合同开始时间',
  `contract_end` date DEFAULT NULL COMMENT '合同结束时间',
  `session_id` char(50) NOT NULL DEFAULT '',
  `is_salesman` tinyint(1) DEFAULT '0' COMMENT '业务员',
  `factory_id` int(11) NOT NULL DEFAULT '0' COMMENT '加工厂',
  PRIMARY KEY (`user_id`),
  KEY `session_id` (`session_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1183 DEFAULT CHARSET=utf8 COMMENT='用户表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_user_login`
--

DROP TABLE IF EXISTS `erp_user_login`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_user_login` (
  `login_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT '0' COMMENT '用户ID',
  `account` char(30) DEFAULT '' COMMENT '账号|OPENID',
  `secretkey` char(50) DEFAULT '' COMMENT '密码|密钥',
  `union_id` char(50) DEFAULT '' COMMENT '微信开放平台ID',
  `login_type` tinyint(1) DEFAULT '1' COMMENT '1.账号登录，2.微信授权登录',
  `login_status` tinyint(1) DEFAULT '1' COMMENT '状态：0、禁用，1、正常',
  `last_login_ip` char(30) DEFAULT '' COMMENT '最近一次登陆IP',
  `last_login_time` char(30) DEFAULT '' COMMENT '最近一次登陆时间',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `session_id` char(20) NOT NULL DEFAULT '',
  PRIMARY KEY (`login_id`),
  KEY `user_id` (`user_id`),
  KEY `login_type` (`login_type`),
  KEY `account` (`account`),
  KEY `union_id` (`union_id`)
) ENGINE=InnoDB AUTO_INCREMENT=379 DEFAULT CHARSET=utf8 COMMENT='用户关联登录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_work`
--

DROP TABLE IF EXISTS `erp_work`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_work` (
  `work_id` smallint(5) unsigned NOT NULL AUTO_INCREMENT COMMENT '工种表',
  `production_class` tinyint(1) NOT NULL DEFAULT '0' COMMENT '生产部门 1裁床2车缝3尾部',
  `work_name` char(10) NOT NULL DEFAULT '' COMMENT '工种名称',
  `work_sort` smallint(5) NOT NULL DEFAULT '100' COMMENT '排序',
  PRIMARY KEY (`work_id`),
  KEY `work_id` (`work_id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_work_group`
--

DROP TABLE IF EXISTS `erp_work_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_work_group` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `production_class` tinyint(1) DEFAULT '0' COMMENT '生产工序表:1=裁床,2=车缝,3=尾部',
  `group_name` char(20) NOT NULL DEFAULT '' COMMENT '工种',
  `sort` int(11) NOT NULL DEFAULT '0',
  `add_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `group_no` char(20) NOT NULL DEFAULT '',
  `opt_user` int(10) DEFAULT NULL COMMENT '操作人',
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `erp_work_processes`
--

DROP TABLE IF EXISTS `erp_work_processes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `erp_work_processes` (
  `processes_id` smallint(5) NOT NULL AUTO_INCREMENT,
  `group_id` int(10) DEFAULT '0' COMMENT '工种',
  `processes_name` varchar(150) NOT NULL DEFAULT '' COMMENT '工序',
  `unit_price` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '单价',
  `processes_sort` smallint(5) NOT NULL DEFAULT '100' COMMENT '排序',
  `status` tinyint(1) NOT NULL DEFAULT '0' COMMENT '-1删除0待完善1正常',
  `opt_user` int(10) DEFAULT NULL COMMENT '操作人',
  `add_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `work_name` char(20) NOT NULL DEFAULT '' COMMENT '工种',
  `work_class` char(20) NOT NULL DEFAULT '' COMMENT '生产分类',
  `group_no` char(20) NOT NULL DEFAULT '' COMMENT '工序编号',
  `work_id` int(11) NOT NULL DEFAULT '0',
  `group_name` char(20) NOT NULL DEFAULT '' COMMENT '工序组名',
  PRIMARY KEY (`processes_id`),
  KEY `work_id` (`work_id`),
  KEY `processes_name` (`processes_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7888 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-23 20:23:22
